import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";

import type { AuthLike } from "@/lib/supabase/types";

async function requireRole(roles: string[]) {
  const supabase = await createClient();
  const auth = supabase.auth as unknown as AuthLike;
  const { data: { user } } = await auth.getUser();
  if (!user) return { error: NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 }) };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !roles.includes(profile.role)) {
    return { error: NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions." } }, { status: 403 }) };
  }
  return { supabase, user, role: profile.role };
}

// GET /api/v1/admin/users — ADMIN/SUPERVISOR full list; GIS_OFFICER engineer directory for assignment create
export async function GET() {
  const access = await requireRole(["ADMIN", "SUPERVISOR", "GIS_OFFICER"]);
  if ("error" in access) return access.error;
  const { supabase, role } = access;

  let query = supabase
    .from("profiles")
    .select("id, email, display_name, role, is_active, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (role === "GIS_OFFICER") {
    query = query.eq("role", "ENGINEER");
  }

  const { data: profiles, error } = await query;

  if (error) {
    return NextResponse.json({ success: false, error: { code: "QUERY_ERROR", message: "Failed to fetch users." } }, { status: 500 });
  }

  if (role !== "GIS_OFFICER") {
    await auditLog({ action: "LIST_USERS", entityType: "user", entityId: "bulk" });
  }

  return NextResponse.json({ success: true, data: { items: profiles } });
}

// POST /api/v1/admin/users — invite user by email (ADMIN only)
export async function POST(req: Request) {
  const admin = await requireRole(["ADMIN"]);
  if ("error" in admin) return admin.error;
  const { supabase } = admin;

  const body = await req.json().catch(() => null);
  const email = body?.email?.trim();
  const role = body?.role;
  const displayName = body?.displayName?.trim();

  if (!email || !role) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Email and role are required." } }, { status: 422 });
  }

  const validRoles = ["ADMIN", "ENGINEER", "APPROVAL_OFFICER", "GIS_OFFICER", "SUPERVISOR"];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: `Invalid role. Must be one of: ${validRoles.join(", ")}` } }, { status: 422 });
  }

  // Create auth user with OTP (no password — they'll use email PIN)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ success: false, error: { code: "CONFIG_ERROR", message: "Service role key not configured." } }, { status: 500 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  // Use service_role to create user
  const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      email,
      email_confirm: true,
      user_metadata: {
        display_name: displayName || email.split("@")[0],
        role,
      },
    }),
  });

  const createData = await createRes.json();

  if (!createRes.ok) {
    return NextResponse.json({ success: false, error: { code: "CREATE_FAILED", message: "Failed to create user. They may already exist." } }, { status: 400 });
  }

  // Update profile role (trigger may have defaulted to ENGINEER)
  if (createData.id) {
    await supabase.from("profiles").update({ role, display_name: displayName || email.split("@")[0] }).eq("id", createData.id);
  }

  await auditLog({ action: "INVITE_USER", entityType: "user", entityId: createData.id ?? email, metadata: { email, role } });

  return NextResponse.json({
    success: true,
    data: { id: createData.id, email, role, display_name: displayName || email.split("@")[0] },
  }, { status: 201 });
}

// PATCH /api/v1/admin/users — update user role or active status
export async function PATCH(req: Request) {
  const admin = await requireRole(["ADMIN"]);
  if ("error" in admin) return admin.error;
  const { supabase, user: currentUser } = admin;

  const body = await req.json().catch(() => null);
  const userId = body?.userId;
  const role = body?.role;
  const isActive = body?.isActive;
  const displayName = body?.displayName?.trim();

  if (!userId) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "userId is required." } }, { status: 422 });
  }

  // Prevent self-demotion
  if (userId === currentUser.id && role && role !== "ADMIN") {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Cannot change your own admin role." } }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if (role) {
    const validRoles = ["ADMIN", "ENGINEER", "APPROVAL_OFFICER", "GIS_OFFICER", "SUPERVISOR"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: `Invalid role.` } }, { status: 422 });
    }
    updates.role = role;
  }
  if (typeof isActive === "boolean") updates.is_active = isActive;
  if (displayName) updates.display_name = displayName;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "No fields to update." } }, { status: 422 });
  }

  const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
  if (error) {
    return NextResponse.json({ success: false, error: { code: "UPDATE_FAILED", message: "Failed to update user." } }, { status: 500 });
  }

  await auditLog({ action: "UPDATE_USER", entityType: "user", entityId: userId, metadata: updates });

  return NextResponse.json({ success: true, data: { id: userId, ...updates } });
}

// DELETE /api/v1/admin/users — deactivate user (soft delete, ADMIN only)
export async function DELETE(req: Request) {
  const admin = await requireRole(["ADMIN"]);
  if ("error" in admin) return admin.error;
  const { supabase, user: currentUser } = admin;

  const body = await req.json().catch(() => null);
  const userId = body?.userId;

  if (!userId) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "userId is required." } }, { status: 422 });
  }

  if (userId === currentUser.id) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Cannot deactivate your own account." } }, { status: 403 });
  }

  const { data: target } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .single();

  if (!target) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "User not found." } }, { status: 404 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: false })
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ success: false, error: { code: "DELETE_FAILED", message: "Failed to deactivate user." } }, { status: 500 });
  }

  await auditLog({ action: "DEACTIVATE_USER", entityType: "user", entityId: userId, metadata: { role: target.role } });

  return NextResponse.json({ success: true });
}
