"use client";

import { useState } from "react";

export type DrawTool = null | "polygon" | "rectangle" | "select" | "locate";

interface MapDrawToolbarProps {
  activeTool: DrawTool;
  onToolChange: (tool: DrawTool) => void;
  isDrawing: boolean;
  drawPoints: number[][];
  onUndo: () => void;
  onCancel: () => void;
  onFinish: () => void;
  onSave: (name: string) => void;
  areaCount: number;
  userRole: string;
}

export default function MapDrawToolbar({
  activeTool,
  onToolChange,
  isDrawing,
  drawPoints,
  onUndo,
  onCancel,
  onFinish,
  onSave,
  areaCount,
  userRole,
}: MapDrawToolbarProps) {
  const [showNameInput, setShowNameInput] = useState(false);
  const [areaName, setAreaName] = useState("");
  const canDraw = ["ADMIN", "SUPERVISOR", "GIS_OFFICER"].includes(userRole);

  function handleSave() {
    if (!areaName.trim()) return;
    onSave(areaName.trim());
    setAreaName("");
    setShowNameInput(false);
  }

  return (
    <>
      {/* Main toolbar — glass morphism */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 rounded-2xl bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-white/40 shadow-2xl shadow-black/10 px-2 py-1.5 transition-all duration-300">
        {/* Draw tools */}
        {canDraw && (
          <>
            <ToolButton
              icon={<PolygonIcon />}
              label="Draw Polygon"
              active={activeTool === "polygon"}
              onClick={() => onToolChange(activeTool === "polygon" ? null : "polygon")}
            />
            <ToolButton
              icon={<RectangleIcon />}
              label="Draw Box"
              active={activeTool === "rectangle"}
              onClick={() => onToolChange(activeTool === "rectangle" ? null : "rectangle")}
            />
            <div className="w-px h-6 bg-black/10 mx-1" />
          </>
        )}

        {/* Select / navigate */}
        <ToolButton
          icon={<CursorIcon />}
          label="Select"
          active={activeTool === "select"}
          onClick={() => onToolChange(activeTool === "select" ? null : "select")}
        />
        <ToolButton
          icon={<LocateIcon />}
          label="My Location"
          active={activeTool === "locate"}
          onClick={() => onToolChange("locate")}
        />

        {/* Area count badge */}
        {areaCount > 0 && (
          <div className="ml-1 px-2.5 py-1 rounded-lg bg-brand/10 text-brand text-xs font-bold">
            {areaCount}
          </div>
        )}
      </div>

      {/* Drawing action bar — appears when actively drawing */}
      {isDrawing && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-2xl bg-white/90 dark:bg-black/70 backdrop-blur-xl border border-white/40 shadow-2xl shadow-black/15 px-4 py-3 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex items-center gap-2 mr-3">
            <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
            <span className="text-sm font-medium text-foreground">
              {drawPoints.length} point{drawPoints.length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs text-muted-foreground">
              {activeTool === "rectangle" ? "Click 2 corners" : "Click to add points"}
            </span>
          </div>

          <button
            onClick={onUndo}
            disabled={drawPoints.length === 0}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 text-foreground transition-colors disabled:opacity-40"
          >
            Undo
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onFinish();
              setShowNameInput(true);
            }}
            disabled={drawPoints.length < 3}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-brand text-white hover:bg-brand-light transition-colors disabled:opacity-40 shadow-md shadow-brand/20"
          >
            Done
          </button>
        </div>
      )}

      {/* Name input modal */}
      {showNameInput && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-border p-6 w-[360px] animate-in zoom-in-95 fade-in duration-200">
            <h3 className="text-lg font-bold text-foreground mb-1">Name This Area</h3>
            <p className="text-sm text-muted-foreground mb-4">Give your inspection area a descriptive name.</p>
            <input
              type="text"
              value={areaName}
              onChange={(e) => setAreaName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="e.g. Mile 2 Axis — Section A"
              className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand/40 mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowNameInput(false); setAreaName(""); }}
                className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!areaName.trim()}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-brand text-white hover:bg-brand-light transition-colors disabled:opacity-40 shadow-md shadow-brand/20"
              >
                Save Area
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ToolButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
        active
          ? "bg-brand text-white shadow-lg shadow-brand/30 scale-105"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {icon}
    </button>
  );
}

function PolygonIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l2 13h16l2-13L12 2z" />
    </svg>
  );
}

function RectangleIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18v14H3z" />
    </svg>
  );
}

function CursorIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
    </svg>
  );
}

function LocateIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a7 7 0 017 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 017-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}
