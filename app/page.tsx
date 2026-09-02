"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "./api";
import {
  AccessMaster,
  DatabaseBatchHistory,
  DynamicDashboard,
  MaterialLedger,
  MaterialMaster,
  PackagingMaster,
  PackagingLedger,
  NotificationCenter,
  OperatorPerformance,
  ReportManager,
  SystemSettingsMaster,
  TutorialButton,
  UserMaster,
  GenericMasterList,
} from "./master-data";
import { PrintableTicket } from "./printable-ticket";

const getProductionSeqOfToday = async (batchId: string, jobId: string, startedAtStr: string): Promise<number> => {
  try {
    const startedAtDate = new Date(startedAtStr);
    const yyyy = startedAtDate.getFullYear();
    const mm = String(startedAtDate.getMonth() + 1).padStart(2, '0');
    const dd = String(startedAtDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    
    const res = await apiFetch<{ data: Array<{ id: string; job_id: string; started_at: string }> }>(
      `/batches?from=${dateStr}&to=${dateStr}`
    );
    
    if (res && res.data) {
      const jobBatches = res.data
        .filter(b => b.job_id === jobId)
        .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
      
      const index = jobBatches.findIndex(b => b.id === batchId);
      return index >= 0 ? index + 1 : jobBatches.length + 1;
    }
  } catch (error) {
    console.error("Error getting production sequence:", error);
  }
  return 1;
};

type Role = "operator" | "supervisor" | "admin";

const getClientRole = (roleId: string, roleName: string): Role => {
  if (roleId === "role-admin") return "admin";
  if (roleId === "role-supervisor") return "supervisor";
  if (roleId === "role-operator") return "operator";
  const nameLower = (roleName || "").toLowerCase();
  if (nameLower.includes("operator")) return "operator";
  return "supervisor";
};
const hasViewPermission = (view: View, authUser: AuthUser | null, role: Role): boolean => {
  if (role === "admin") return true;
  if (!authUser) return false;
  const userPermissions = authUser.permissions;
  if (!userPermissions) {
    return [
      "home",
      "material-ledger",
      "packaging-ledger",
      "performance",
      "history",
      "reports",
      "account",
    ].includes(view);
  }
  switch (view) {
    case "home":
      return userPermissions.includes("dashboard.view");
    case "jobs":
      return userPermissions.includes("jobs.manage");
    case "materials":
      return userPermissions.includes("materials.manage");
    case "master-packaging":
      return userPermissions.includes("packaging.manage");
    case "master-areas":
    case "master-lines":
    case "master-shifts":
    case "master-units":
      return userPermissions.includes("operational_config.manage");
    case "material-ledger":
      return userPermissions.includes("materials.manage") || 
             userPermissions.includes("dashboard.view") || 
             userPermissions.includes("batches.view_all");
    case "packaging-ledger":
      return userPermissions.includes("packaging.manage") || 
             userPermissions.includes("dashboard.view") || 
             userPermissions.includes("batches.view_all");
    case "history":
      return userPermissions.includes("batches.view_all");
    case "performance":
      return userPermissions.includes("dashboard.view") || 
             userPermissions.includes("batches.view_all");
    case "reports":
      return userPermissions.includes("reports.view");
    case "users":
      return userPermissions.includes("users.manage");
    case "access":
      return userPermissions.includes("roles.manage");
    case "settings":
      return userPermissions.includes("settings.manage");
    case "account":
      return true;
    default:
      return false;
  }
};
type View =
  | "home"
  | "active"
  | "history"
  | "account"
  | "jobs"
  | "materials"
  | "material-ledger"
  | "packaging-ledger"
  | "users"
  | "access"
  | "performance"
  | "reports"
  | "master-areas"
  | "master-lines"
  | "master-shifts"
  | "master-units"
  | "settings";
type BatchStatus =
  "Ready" | "In Progress" | "Paused" | "Completed" | "Cancelled";
type StepState = "ready" | "running" | "confirm" | "paused" | "completed";

type Step = {
  id: number | string;
  title: string;
  instruction: string;
  warning: string;
  duration: number;
  action: string;
  sound_completed_id?: string;
  sound_warning_id?: string;
  allow_overdrive?: boolean;
  loop_warning?: boolean;
};

type Material = {
  id?: string;
  material_id?: string;
  name: string;
  qty: number;
  unit: string;
  unit_price?: number;
  currency?: string;
  line_cost?: number;
};

type Packaging = {
  id?: string;
  packaging_id?: string;
  name: string;
  qty: number;
  unit: string;
  unit_price?: number;
  currency?: string;
  line_cost?: number;
  min_sku?: number;
};

type Job = {
  id: string;
  name: string;
  product: string;
  product_code?: string;
  target: number;
  unit: string;
  shift: string;
  area: string;
  line: string;
  version: number;
  status: "Published" | "Draft" | "Archived";
  updated: string;
  popupEnabled?: boolean;
  popupTitle?: string;
  popupMessage?: string;
  materials: Material[];
  packagings: Packaging[];
  steps: Step[];
  sound_step_completed_id?: string;
  sound_job_completed_id?: string;
  sound_paused_id?: string;
  sound_stopped_id?: string;
  allowOverdrive?: boolean;
};

type AuthUser = {
  id: string;
  username: string;
  name: string;
  role_id: string;
  role_name: string;
  shift: string;
  employee_no: string;
  permissions?: string[];
};

type OperatorPopup = {
  enabled: boolean;
  title: string;
  message: string;
  requireAcknowledge: boolean;
};
type ProcessAlert = {
  kind: "paused" | "expired" | "complete";
  title: string;
  message: string;
};

type BatchEvent = {
  time: string;
  title: string;
  detail: string;
  tone: "blue" | "green" | "orange" | "red";
};

type Batch = {
  id: string;
  jobSnapshot: Job;
  operator: string;
  startedAt: number;
  completedAt?: number;
  area?: string;
  line?: string;
  currentStep: number;
  stepState: StepState;
  stepEndsAt: number;
  status: BatchStatus;
  notes: Record<number, string>;
  events: BatchEvent[];
  output?: number;
  batch_no?: string;
  packaging_code?: string;
  expired_date?: string;
  storage_location?: string;
  filling_date?: string;
  special_notes?: string;
  actual_materials?: Record<string, number>;
  pausedRemainingSeconds?: number;
};

const JOBS: Job[] = [];

type HistoryRow = {
  id: string;
  job: string;
  operator: string;
  output: string;
  status: BatchStatus;
  date: string;
  duration: string;
  area?: string;
  rawBatch?: any;
};

const NAV_GROUPS: Array<{ title: string; items: Array<{ view: View; icon: string; label: string }> }> = [
  {
    title: "OPERASIONAL",
    items: [
      { view: "home", icon: "bi-grid-1x2-fill", label: "Dashboard Utama" },
      { view: "jobs", icon: "bi-journal-richtext", label: "Instruksi Kerja (Jobs)" },
      { view: "material-ledger", icon: "bi-arrow-left-right", label: "Penggunaan Bahan" },
      { view: "packaging-ledger", icon: "bi-box-arrow-right", label: "Penggunaan Kemasan" },
      { view: "history", icon: "bi-clock-history", label: "Riwayat Batch Produksi" },
    ]
  },
  {
    title: "MASTER DATA",
    items: [
      { view: "materials", icon: "bi-box-seam", label: "Master Bahan Baku" },
      { view: "master-packaging", icon: "bi-box", label: "Master Kemasan (Packaging)" },
      { view: "master-areas", icon: "bi-geo-alt", label: "Area Produksi" },
      { view: "master-lines", icon: "bi-diagram-3", label: "Line Operasional" },
      { view: "master-shifts", icon: "bi-clock", label: "Shift Kerja" },
      { view: "master-units", icon: "bi-rulers", label: "Satuan Ukur" },
    ]
  },
  {
    title: "LAPORAN & ANALITIK",
    items: [
      { view: "performance", icon: "bi-speedometer2", label: "Performa Operator" },
      { view: "reports", icon: "bi-bar-chart-line", label: "Laporan & Biaya" },
    ]
  },
  {
    title: "SISTEM & AKSES",
    items: [
      { view: "users", icon: "bi-people", label: "Kelola Pengguna" },
      { view: "access", icon: "bi-shield-lock", label: "Hak Akses & Role" },
      { view: "settings", icon: "bi-gear", label: "Pengaturan Sistem" },
    ]
  },
  {
    title: "AKUN",
    items: [
      { view: "account", icon: "bi-person-badge", label: "Profil Saya" },
    ]
  }
];

const fmtClock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
const fmtDate = (time: number) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(time);
const fmtRupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

function playAlertTone(kind: ProcessAlert["kind"]) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const context = new AudioCtx();
    const patterns =
      kind === "complete"
        ? [660, 880, 1040]
        : kind === "paused"
          ? [520, 390, 520]
          : [880, 880, 740, 880];
    patterns.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, context.currentTime + index * 0.24);
      gain.gain.exponentialRampToValueAtTime(
        0.16,
        context.currentTime + index * 0.24 + 0.02,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        context.currentTime + index * 0.24 + 0.18,
      );
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + index * 0.24);
      oscillator.stop(context.currentTime + index * 0.24 + 0.2);
    });
    window.setTimeout(() => void context.close(), patterns.length * 260 + 120);
  } catch {
    /* alert visual tetap tersedia bila browser memblokir audio */
  }
}

function StatusBadge({ status }: { status: BatchStatus | Job["status"] }) {
  return (
    <span
      className={`status-badge status-${status.toLowerCase().replace(" ", "-")}`}
    >
      <span className="status-dot" />
      {status}
    </span>
  );
}

function LogoMark() {
  return (
    <span className="logo-mark" aria-hidden="true" style={{ padding: "4px", background: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <img src="/mova-corp-logo.png" alt="Mova" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
    </span>
  );
}

function parseStepTitle(title: string) {
  if (!title) return { name: "", qty: "", unit: "" };
  const parts = title.split(" - ");
  if (parts.length >= 2) {
    const name = parts.slice(0, parts.length - 1).join(" - ");
    const qtyUnitStr = parts[parts.length - 1];
    const match = qtyUnitStr.match(/^([\d.,]+)\s*(.*)$/);
    if (match) {
      const qty = match[1];
      const unit = match[2] ? match[2] : "";
      return { name, qty, unit };
    }
  }
  return { name: title, qty: "", unit: "" };
}

function formatStepTitle(name: string, qty: string, unit: string) {
  const cleanName = name || "";
  const cleanQty = qty || "";
  const cleanUnit = unit || "";
  if (cleanQty) {
    return cleanUnit ? `${cleanName} - ${cleanQty} ${cleanUnit}` : `${cleanName} - ${cleanQty}`;
  }
  return cleanName;
}

export default function Home({
  expectedRole,
  forceLoginScreen,
}: {
  expectedRole?: Role;
  forceLoginScreen?: boolean;
} = {}) {
  const [hydrated, setHydrated] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const operatorName = authUser?.name || "";
  const [view, setView] = useState<View>("home");
  const [jobs, setJobs] = useState<Job[]>(JOBS);
  const [availableSounds, setAvailableSounds] = useState<{ id: string; name: string; filename: string }[]>([]);
  const [masterAreas, setMasterAreas] = useState<{ id: string; name: string }[]>([]);
  const [masterLines, setMasterLines] = useState<{ id: string; name: string; area_id: string }[]>([]);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [now, setNow] = useState(0);
  const [note, setNote] = useState("");
  const [output, setOutput] = useState("0");
  const [actualMaterials, setActualMaterials] = useState<Record<string, number>>({});
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(true);
  const [overrideType, setOverrideType] = useState<"resume" | "earlyCompletion" | "pause" | null>(null);
  const [overdrivePausedRemaining, setOverdrivePausedRemaining] = useState<number | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [cancelPin, setCancelPin] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [lowStockItems, setLowStockItems] = useState<Array<{
    type: "Material" | "Packaging";
    code: string;
    name: string;
    stock: number;
    min_sku: number;
    unit: string;
  }>>([]);
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const prevLowStockCount = useRef<number>(0);
  const [reportQuery, setReportQuery] = useState("");
  const [dbHistory, setDbHistory] = useState<HistoryRow[]>([]);
  const [databaseOnline, setDatabaseOnline] = useState(false);
  const [popupLoaded, setPopupLoaded] = useState(false);
  const [popupSetting, setPopupSetting] = useState<OperatorPopup>({
    enabled: true,
    title: "Pengingat sebelum bekerja",
    message:
      "Pastikan APD lengkap, baca kembali SOP, dan awali pekerjaan dengan berdoa sesuai keyakinan masing-masing.",
    requireAcknowledge: true,
  });
  const [showStartNotice, setShowStartNotice] = useState(false);
  const [showLoginNotice, setShowLoginNotice] = useState(false);
  const [startAcknowledged, setStartAcknowledged] = useState(false);
  const [processAlert, setProcessAlert] = useState<ProcessAlert | null>(null);
  const alarmedStep = useRef<string>("");
  const loginNoticeShown = useRef(false);
  const syncAttempted = useRef(false);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (activeAudioRef.current) {
        try {
          activeAudioRef.current.pause();
        } catch (err) {
          console.warn("Gagal menghentikan audio pada unmount:", err);
        }
      }
    };
  }, []);

  const checkLowStock = useCallback(async () => {
    try {
      const matRes = await apiFetch<{ data: any[] }>("/materials");
      const pkgRes = await apiFetch<{ data: any[] }>("/master_packaging");
      const lowMats = matRes.data
        .filter(m => m.status === "Active" && m.min_sku !== undefined && m.min_sku !== null && m.min_sku > 0 && Number(m.initial_stock || 0) <= m.min_sku)
        .map(m => ({
          type: "Material" as const,
          code: m.code,
          name: m.name,
          stock: Number(m.initial_stock || 0),
          min_sku: Number(m.min_sku || 0),
          unit: m.unit
        }));
      const lowPkgs = pkgRes.data
        .filter(p => p.status === "Active" && p.min_sku !== undefined && p.min_sku !== null && p.min_sku > 0 && Number(p.initial_stock || 0) <= p.min_sku)
        .map(p => ({
          type: "Packaging" as const,
          code: p.code,
          name: p.name,
          stock: Number(p.initial_stock || 0),
          min_sku: Number(p.min_sku || 0),
          unit: p.unit
        }));
      const totalLow = [...lowMats, ...lowPkgs];
      setLowStockItems(totalLow);
      if (totalLow.length > 0 && totalLow.length > prevLowStockCount.current) {
        setToast("Silakan cek, ada bahan yang segera habis!");
      }
      prevLowStockCount.current = totalLow.length;
    } catch (err) {
      console.error("Gagal memeriksa low stock:", err);
    }
  }, []);

  useEffect(() => {
    if (role === "admin" || role === "supervisor") {
      checkLowStock();
      const interval = setInterval(checkLowStock, 30000);
      return () => clearInterval(interval);
    } else {
      setLowStockItems([]);
      prevLowStockCount.current = 0;
    }
  }, [role, checkLowStock]);

  useEffect(() => {
    const savedRole = localStorage.getItem("automova-role") as Role | null;
    const savedUser = localStorage.getItem("automova-user");
    const savedBatch = localStorage.getItem("automova-active-batch");

    queueMicrotask(() => {
      let activeRole = savedRole;
      let activeUser = savedUser ? JSON.parse(savedUser) : null;
      if (activeUser) {
        activeRole = getClientRole(activeUser.role_id, activeUser.role_name || "");
      }

      if (!activeRole || !activeUser) {
        setRole(null);
        setAuthUser(null);
        if (expectedRole && typeof window !== "undefined" && window.location.pathname !== "/login" && window.location.pathname !== "/") {
          window.location.href = "/login";
          return;
        }
      } else {
        if (expectedRole) {
          if (expectedRole === "admin" && activeRole !== "admin") {
            window.location.href = `/mova-${activeRole}`;
            return;
          }
          if (expectedRole === "supervisor" && activeRole !== "supervisor" && activeRole !== "admin") {
            window.location.href = `/mova-${activeRole}`;
            return;
          }
          if (expectedRole === "operator" && activeRole !== "operator" && activeRole !== "admin" && activeRole !== "supervisor") {
            window.location.href = `/mova-${activeRole}`;
            return;
          }
        } else if (!forceLoginScreen && typeof window !== "undefined") {
          if (window.location.pathname === "/" || window.location.pathname === "/login") {
            window.location.href = `/mova-${activeRole}`;
            return;
          }
        }
        setRole(activeRole);
        setAuthUser(activeUser);
        if (activeUser && activeRole) {
          const currentPermitted = hasViewPermission("home", activeUser, activeRole);
          if (!currentPermitted) {
            const firstPermitted = NAV_GROUPS.flatMap((g) => g.items)
              .find((item) => hasViewPermission(item.view, activeUser, activeRole))?.view;
            if (firstPermitted) {
              setView(firstPermitted);
            }
          }
          // Fetch fresh user data and permissions in the background
          apiFetch<{ data: AuthUser }>("/users/" + activeUser.id)
            .then((res) => {
              const updatedUser = res.data;
              if (updatedUser) {
                const updatedRole = getClientRole(updatedUser.role_id, updatedUser.role_name || "");
                setAuthUser(updatedUser);
                setRole(updatedRole);
                localStorage.setItem("automova-role", updatedRole);
                localStorage.setItem("automova-user", JSON.stringify(updatedUser));
                
                // If the updated user no longer has access to the current view, redirect them
                setView((prevView) => {
                  if (!hasViewPermission(prevView, updatedUser, updatedRole)) {
                    return hasViewPermission("home", updatedUser, updatedRole)
                      ? "home"
                      : (NAV_GROUPS.flatMap((g) => g.items).find((item) => hasViewPermission(item.view, updatedUser, updatedRole))?.view || "account");
                  }
                  return prevView;
                });
              }
            })
            .catch((err) => console.warn("Gagal menyinkronkan profil terbaru:", err));
        }
      }

      if (savedBatch) setBatch(JSON.parse(savedBatch));
      setOnline(navigator.onLine);
      setNow(Date.now());
      setHydrated(true);
    });
  }, [expectedRole, forceLoginScreen]);

  useEffect(() => {
    if (
      hydrated &&
      popupLoaded &&
      role === "operator" &&
      popupSetting.enabled &&
      !loginNoticeShown.current
    ) {
      loginNoticeShown.current = true;
      queueMicrotask(() => {
        setStartAcknowledged(false);
        setShowLoginNotice(true);
      });
    }
  }, [hydrated, popupLoaded, popupSetting.enabled, role]);

  useEffect(() => {
    if (
      !hydrated ||
      !popupLoaded ||
      !authUser ||
      role !== "operator" ||
      jobs.length === 0
    )
      return;

    const syncActiveBatch = async () => {
      try {
        // If current local batch is already completed, do not interrupt completion UI
        if (batch && (batch.status === "Completed" || batch.stepState === "completed")) return;

        const params = new URLSearchParams({
          from: "2020-01-01",
          operator: authUser.id,
        });
        const response = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          `/batches?${params}`,
        );
        
        const activeRaw = response.data ? response.data.find(
          (b: any) =>
            b.status === "In Progress" ||
            b.status === "Ready" ||
            b.status === "Paused",
        ) : null;

        if (!activeRaw) {
          // If local batch is completed, do not clear it
          if (batch && (batch.status === "Completed" || batch.stepState === "completed")) return;
          if (batch && Date.now() - batch.startedAt > 5000) {
            setBatch(null);
            setView("home");
            setToast("Pekerjaan aktif telah diselesaikan atau dibatalkan dari perangkat lain.");
          }
          return;
        }

        const detailRes = await apiFetch<{ data: Record<string, any> }>(
          `/batches/${activeRaw.id}`,
        );
        const serverBatch = detailRes.data;

        // If local batch is ahead of server batch step index or already completed, don't revert
        if (batch && batch.id === serverBatch.id && (batch.status === "Completed" || serverBatch.current_step < batch.currentStep)) {
          return;
        }

        const jobSnap = jobs.find((j) => j.id === serverBatch.job_id);
        if (!jobSnap) return;

        const parsedEvents = (serverBatch.events || []).map((e: any) => ({
          time: e.event_time,
          title: e.title,
          detail: e.detail,
          tone:
            e.event_type === "start" || e.event_type === "step"
              ? "blue"
              : e.event_type === "pause"
                ? "orange"
                : "green",
        }));

        let stepState: StepState = "ready";
        let stepEndsAt = 0;
        let pausedRemainingSeconds: number | undefined = undefined;

        const parseRemainingFromDetail = (detailStr?: string): number | null => {
          if (!detailStr) return null;
          const match = detailStr.match(/\[SISA:(\d+)s\]/);
          return match ? parseInt(match[1], 10) : null;
        };

        if (serverBatch.status === "Ready") {
          stepState = "ready";
        } else if (serverBatch.status === "Paused") {
          stepState = "paused";
          const lastPauseEvent = [...parsedEvents].reverse().find((e: any) =>
            e.title.includes(`Step ${serverBatch.current_step + 1}`) && e.title.includes("dijeda")
          );
          const parsedRem = parseRemainingFromDetail(lastPauseEvent?.detail);
          if (parsedRem !== null) {
            pausedRemainingSeconds = parsedRem;
          } else if (batch && batch.id === serverBatch.id && batch.pausedRemainingSeconds !== undefined && batch.pausedRemainingSeconds > 0) {
            pausedRemainingSeconds = batch.pausedRemainingSeconds;
          } else {
            pausedRemainingSeconds = (jobSnap.steps || [])[serverBatch.current_step]?.duration || 0;
          }
        } else if (serverBatch.status === "In Progress") {
          // Search for step-specific start/resume event
          const stepStartEvent = [...parsedEvents]
            .reverse()
            .find(
              (e: any) =>
                e.title.includes(`Step ${serverBatch.current_step + 1}`) ||
                e.title.includes(`step ${serverBatch.current_step + 1}`) ||
                e.title.includes("dimulai") ||
                e.title.includes("dilanjutkan"),
            );

          if (stepStartEvent && (jobSnap.steps || [])[serverBatch.current_step]) {
            const parsedRem = parseRemainingFromDetail(stepStartEvent.detail);
            const durationSec = parsedRem !== null 
              ? parsedRem 
              : ((jobSnap.steps || [])[serverBatch.current_step].duration || 0);

            stepEndsAt = new Date(stepStartEvent.time).getTime() + durationSec * 1000;
            if (stepEndsAt < Date.now()) {
              stepState = "confirm";
            } else {
              stepState = "running";
            }
          } else {
            stepState = "running";
            const durationSec = (jobSnap.steps || [])[serverBatch.current_step]?.duration || 0;
            stepEndsAt = Date.now() + durationSec * 1000;
          }
        }

        // If local batch is actively running on the same batch & step, preserve local stepEndsAt to avoid tick drift
        if (
          batch &&
          batch.id === serverBatch.id &&
          batch.status === "In Progress" &&
          batch.stepState === "running" &&
          batch.currentStep === serverBatch.current_step &&
          stepEndsAt > Date.now()
        ) {
          stepEndsAt = batch.stepEndsAt;
        }

        // Compare if we need to update state
        // Only update if batch ID, status, current step, or event count changed
        const isDifferent =
          !batch ||
          batch.id !== serverBatch.id ||
          batch.status !== serverBatch.status ||
          batch.currentStep !== serverBatch.current_step ||
          batch.events.length !== parsedEvents.length;

        if (isDifferent) {
          const reconstructedBatch: Batch = {
            id: serverBatch.id,
            jobSnapshot: jobSnap,
            operator: serverBatch.operator_name,
            startedAt: new Date(serverBatch.started_at).getTime(),
            completedAt: serverBatch.completed_at
              ? new Date(serverBatch.completed_at).getTime()
              : undefined,
            currentStep: serverBatch.current_step,
            stepState,
            stepEndsAt: (batch && batch.id === serverBatch.id && batch.currentStep === serverBatch.current_step && batch.stepState === "running") ? batch.stepEndsAt : stepEndsAt,
            status: serverBatch.status as BatchStatus,
            notes: {},
            events: parsedEvents,
            output: serverBatch.output ?? undefined,
            pausedRemainingSeconds,
          };

          setBatch(reconstructedBatch);
          if (!batch) {
            setView("active");
            setToast("Pekerjaan aktif dipulihkan dari server.");
          } else if (batch.id !== serverBatch.id) {
            setView("active");
            setToast("Pekerjaan aktif diperbarui dari server.");
          }
        }
      } catch (err) {
        console.error("Gagal sinkronisasi batch aktif", err);
      }
    };

    void syncActiveBatch();

    const timer = window.setInterval(() => {
      void syncActiveBatch();
    }, 5000);

    return () => window.clearInterval(timer);
  }, [hydrated, authUser, popupLoaded, role, jobs, batch]);

  useEffect(() => {
    const loadDatabase = async () => {
      try {
        const [jobResponse, popupResponse, soundsResponse, areasResponse, linesResponse] = await Promise.all([
          apiFetch<{ data: Array<Record<string, unknown>> }>("/jobs"),
          apiFetch<{ data: OperatorPopup }>("/settings/operator-popup"),
          apiFetch<{ data: Array<{ id: string; name: string; filename: string }> }>("/sounds").catch(() => ({ data: [] })),
          apiFetch<{ data: Array<{ id: string; name: string }> }>("/master_areas").catch(() => ({ data: [] })),
          apiFetch<{ data: Array<{ id: string; name: string; area_id: string }> }>("/master_lines").catch(() => ({ data: [] })),
        ]);
        const mapped: Job[] = jobResponse.data.map((raw) => ({
          id: String(raw.id),
          name: String(raw.name),
          product: String(raw.product),
          product_code: String(raw.product_code || ""),
          target: Number(raw.target),
          unit: String(raw.unit),
          shift: String(raw.shift),
          area: String(raw.area),
          line: String(raw.line),
          version: Number(raw.version),
          status: String(raw.status) as Job["status"],
          updated: String(raw.updated_at || ""),
          popupEnabled: Boolean(raw.popup_enabled),
          popupTitle: String(raw.popup_title || ""),
          popupMessage: String(raw.popup_message || ""),
          allowOverdrive: raw.allow_overdrive !== 0,
          sound_step_completed_id: raw.sound_step_completed_id ? String(raw.sound_step_completed_id) : undefined,
          sound_job_completed_id: raw.sound_job_completed_id ? String(raw.sound_job_completed_id) : undefined,
          sound_paused_id: raw.sound_paused_id ? String(raw.sound_paused_id) : undefined,
          sound_stopped_id: raw.sound_stopped_id ? String(raw.sound_stopped_id) : undefined,
          materials: (
            (raw.materials as Array<Record<string, unknown>>) || []
          ).map((material) => ({
            id: String(material.id),
            material_id: material.material_id
              ? String(material.material_id)
              : undefined,
            name: String(material.name),
            qty: Number(material.qty),
            unit: String(material.unit),
            unit_price: Number(material.unit_price || 0),
            currency: String(material.currency || "IDR"),
            line_cost: Number(material.line_cost || 0),
          })),
          packagings: (
            (raw.packagings as Array<Record<string, unknown>>) || []
          ).map((pkg) => ({
            id: String(pkg.id),
            packaging_id: pkg.packaging_id
              ? String(pkg.packaging_id)
              : undefined,
            name: String(pkg.name),
            qty: Number(pkg.qty),
            unit: String(pkg.unit),
            unit_price: Number(pkg.unit_price || 0),
            currency: String(pkg.currency || "IDR"),
            line_cost: Number(pkg.line_cost || 0),
          })),
          steps: ((raw.steps as Array<Record<string, unknown>>) || []).map(
            (step) => ({
              id: String(step.id),
              title: String(step.title),
              instruction: String(step.instruction),
              warning: String(step.warning || ""),
              duration: Number(step.duration_seconds ?? step.duration),
              action: String(step.action_label ?? step.action),
              sound_completed_id: step.sound_completed_id ? String(step.sound_completed_id) : undefined,
              sound_warning_id: step.sound_warning_id ? String(step.sound_warning_id) : undefined,
              allow_overdrive: step.allow_overdrive !== false,
              loop_warning: step.loop_warning !== false,
            }),
          ),
        }));
        setJobs(mapped);
        setPopupSetting(popupResponse.data);
        setAvailableSounds(soundsResponse.data || []);
        setMasterAreas(areasResponse.data || []);
        setMasterLines(linesResponse.data || []);
        setPopupLoaded(true);
        setDatabaseOnline(true);
      } catch {
        setPopupLoaded(true);
        setDatabaseOnline(false);
        setToast(
          "Database server belum aktif. Data contoh tetap dapat digunakan.",
        );
      }
    };
    void loadDatabase();
  }, []);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (batch)
      localStorage.setItem("automova-active-batch", JSON.stringify(batch));
    else localStorage.removeItem("automova-active-batch");
  }, [batch, hydrated]);

  const stopActiveAudio = useCallback(() => {
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      } catch (err) {
        console.warn("Gagal menghentikan audio:", err);
      }
      activeAudioRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (view !== "active") {
      stopActiveAudio();
    }
  }, [view, stopActiveAudio]);

  const triggerAudioEvent = useCallback((eventKind: "step_completed" | "job_completed" | "paused" | "stopped" | "expired", currentBatch: Batch | null) => {
    stopActiveAudio();

    if (!currentBatch) {
      playAlertTone(eventKind === "step_completed" || eventKind === "job_completed" ? "complete" : eventKind === "expired" ? "expired" : "paused");
      return;
    }
    const jobSnap = currentBatch.jobSnapshot;
    const currentStepIndex = currentBatch.currentStep;
    const stepSnap = (jobSnap.steps || [])[currentStepIndex];

    let soundId: string | undefined = undefined;

    if (eventKind === "job_completed") {
      soundId = jobSnap.sound_job_completed_id;
    } else if (eventKind === "step_completed") {
      soundId = stepSnap?.sound_completed_id || jobSnap.sound_step_completed_id;
    } else if (eventKind === "paused") {
      soundId = jobSnap.sound_paused_id;
    } else if (eventKind === "stopped") {
      soundId = jobSnap.sound_stopped_id;
    } else if (eventKind === "expired") {
      soundId = stepSnap?.sound_completed_id || jobSnap.sound_step_completed_id || stepSnap?.sound_warning_id;
    }

    if (soundId) {
      const sound = availableSounds.find((s) => s.id === soundId);
      if (sound) {
        const audio = new Audio(`/api/sounds/file/${sound.filename}`);
        audio.loop = eventKind === "expired" && stepSnap?.loop_warning !== false;
        activeAudioRef.current = audio;
        audio.play().catch((err) => {
          console.warn("Gagal memutar audio kustom:", err);
          playAlertTone(eventKind === "step_completed" || eventKind === "job_completed" ? "complete" : eventKind === "expired" ? "expired" : "paused");
        });
        return;
      }
    }

    playAlertTone(eventKind === "step_completed" || eventKind === "job_completed" ? "complete" : eventKind === "expired" ? "expired" : "paused");
  }, [availableSounds]);

  useEffect(() => {
    if (!batch || batch.stepState !== "running" || batch.stepEndsAt > now)
      return;
    const alarmKey = `${batch.id}-${batch.currentStep}`;
    queueMicrotask(() =>
      setBatch((current) =>
        current
          ? {
              ...current,
              stepState: "confirm",
              events: [
                ...current.events,
                {
                  time: new Date().toISOString(),
                  title: "Timer selesai",
                  detail: (current.jobSnapshot.steps || [])[current.currentStep].title,
                  tone: "orange",
                },
              ],
            }
          : current,
      ),
    );
    if (alarmedStep.current !== alarmKey) {
      alarmedStep.current = alarmKey;
      triggerAudioEvent("expired", batch);
      queueMicrotask(() =>
        setProcessAlert({
          kind: "expired",
          title: "Timer telah selesai",
          message: `${(batch.jobSnapshot.steps || [])[batch.currentStep].title} menunggu konfirmasi YES atau NO.`,
        }),
      );
      void apiFetch("/notifications", {
        method: "POST",
        body: JSON.stringify({
          target_role: "operator",
          title: "Timer selesai",
          message: `${(batch.jobSnapshot.steps || [])[batch.currentStep].title} menunggu konfirmasi.`,
          type: "warning",
          link_view: "active",
        }),
      }).catch(() => undefined);
    }
  }, [batch, now]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  const login = async (username: string, password: string): Promise<string | null> => {
    try {
      const response = await apiFetch<{ data: AuthUser; error?: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      const user = response.data;
      const selectedRole = getClientRole(user.role_id, user.role_name || "");
      setAuthUser(user);
      setRole(selectedRole);
      localStorage.setItem("automova-role", selectedRole);
      localStorage.setItem("automova-user", JSON.stringify(user));
      let defaultView: View = "home";
      if (!hasViewPermission("home", user, selectedRole)) {
        const firstPermitted = NAV_GROUPS.flatMap((g) => g.items)
          .find((item) => hasViewPermission(item.view, user, selectedRole))?.view;
        if (firstPermitted) {
          defaultView = firstPermitted;
        }
      }
      setView(defaultView);
      let effectivePopup = popupSetting;
      if (selectedRole === "operator") {
        try {
          const popupResponse = await apiFetch<{ data: OperatorPopup }>("/settings/operator-popup");
          effectivePopup = popupResponse.data;
          setPopupSetting(popupResponse.data);
          setPopupLoaded(true);
        } catch { /* keep default */ }
      }
      loginNoticeShown.current = selectedRole === "operator" && effectivePopup.enabled;
      if (selectedRole === "operator" && effectivePopup.enabled) {
        setStartAcknowledged(false);
        setShowLoginNotice(true);
      }
      if (typeof window !== "undefined") {
        const targetPath = `/mova-${selectedRole}`;
        if (window.location.pathname !== targetPath) {
          window.location.href = targetPath;
        }
      }
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Login gagal";
    }
  };

  const logout = () => {
    localStorage.removeItem("automova-role");
    localStorage.removeItem("automova-user");
    localStorage.removeItem("automova-active-batch");
    loginNoticeShown.current = false;
    setShowLoginNotice(false);
    setRole(null);
    setAuthUser(null);
    setDbHistory([]);
    setView("home");
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  };

  const persistBatch = (value: Batch) => {
    const operatorId = authUser?.id || null;
    const actualDuration = Math.max(
      0,
      Math.floor(((value.completedAt || Date.now()) - value.startedAt) / 1000),
    );
    const plannedDuration = (value.jobSnapshot.steps || []).reduce(
      (sum, step) => sum + step.duration,
      0,
    );
    void apiFetch("/batches", {
      method: "POST",
      body: JSON.stringify({
        id: value.id,
        job_id: value.jobSnapshot.id,
        job_name: value.jobSnapshot.name,
        job_version: value.jobSnapshot.version,
        operator_id: operatorId,
        operator_name: value.operator,
        area: value.area,
        line: value.line || value.jobSnapshot.line || "",
        status: value.status,
        current_step: value.currentStep,
        started_at: new Date(value.startedAt).toISOString(),
        completed_at: value.completedAt
          ? new Date(value.completedAt).toISOString()
          : null,
        output: value.output,
        unit: value.jobSnapshot.unit,
        planned_duration: plannedDuration,
        actual_duration: actualDuration,
        pause_count: value.events.filter(
          (event) => event.title === "Batch dijeda",
        ).length,
        on_time: actualDuration <= plannedDuration * 1.15,
        batch_no: value.batch_no || "",
        packaging_code: value.packaging_code || "",
        expired_date: value.expired_date || "",
        storage_location: value.storage_location || "",
        filling_date: value.filling_date || "",
        special_notes: value.special_notes || "",
        events: value.events.map((event, index) => ({
          id: `${value.id}-${index}`,
          event_time: event.time,
          event_type: event.title.includes("selesai")
            ? "complete"
            : event.title.includes("dimulai")
              ? "start"
              : event.title.includes("dijeda")
                ? "pause"
                : "step",
          title: event.title,
          detail: event.detail,
          actor: value.operator,
        })),
        actual_materials: value.status === "Completed" ? actualMaterials : undefined,
      }),
    })
      .then(() => setDatabaseOnline(true))
      .catch(() => setDatabaseOnline(false));
  };

  const createNotification = (
    targetRole: Role | "all",
    title: string,
    message: string,
    type: "info" | "warning" | "success" = "info",
    linkView = "",
  ) => {
    void apiFetch("/notifications", {
      method: "POST",
      body: JSON.stringify({
        target_role: targetRole,
        title,
        message,
        type,
        link_view: linkView,
      }),
    }).catch(() => undefined);
  };

  const startJob = (job: Job, selectedArea: string = "", selectedLine: string = "") => {
    if (batch && batch.status !== "Completed" && batch.status !== "Cancelled") {
      setToast("Selesaikan atau batalkan batch aktif terlebih dahulu.");
      setView("active");
      return;
    }
    stopActiveAudio();
    
    // Initialize actual materials from job recipe
    const initialMaterials: Record<string, number> = {};
    if (job.materials) {
      job.materials.forEach(m => {
        initialMaterials[m.id] = m.qty;
      });
    }
    setActualMaterials(initialMaterials);
    
    const localDateStr = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const id = `BATCH-${localDateStr.replaceAll("-", "")}-${String(Math.floor(Math.random() * 899) + 100)}`;
    const startedAt = Date.now();
    const snapshot = JSON.parse(JSON.stringify(job)) as Job;
    const durationSec = snapshot.steps && snapshot.steps.length > 0 ? (snapshot.steps[0].duration || 0) : 0;
    const nextBatch: Batch = {
      id,
      jobSnapshot: snapshot,
      operator: operatorName,
      area: selectedArea || snapshot.area,
      line: selectedLine || snapshot.line,
      startedAt,
      currentStep: 0,
      stepState: "ready",
      stepEndsAt: 0,
      status: "In Progress",
      notes: {},
      events: [
        {
          time: new Date().toISOString(),
          title: "Batch dimulai",
          detail: `${job.name} v${job.version} oleh ${operatorName}`,
          tone: "blue",
        },
      ],
    };
    setBatch(nextBatch);
    persistBatch(nextBatch);
    setNote("");
    setOutput("0");
    setView("active");
    setStartAcknowledged(false);
    setShowStartNotice(false);
    setToast(`${id} siap. Timer belum dimulai.`);
  };

  const beginStep = () => {
    if (!batch || batch.stepState !== "ready") return;
    stopActiveAudio();
    const nextBatch: Batch = {
      ...batch,
      status: "In Progress",
      stepState: "running",
      stepEndsAt:
        Date.now() + (batch.jobSnapshot.steps || [])[batch.currentStep].duration * 1000,
      events: [
        ...batch.events,
        {
          time: new Date().toISOString(),
          title: `Timer step ${batch.currentStep + 1} dimulai`,
          detail: (batch.jobSnapshot.steps || [])[batch.currentStep].title,
          tone: "blue",
        },
      ],
    };
    setBatch(nextBatch);
    persistBatch(nextBatch);
    setToast("Timer berjalan berdasarkan waktu server.");
  };

  const markAction = () => {
    if (!batch || batch.stepState !== "running") return;
    stopActiveAudio();
    setBatch({
      ...batch,
      stepState: "confirm",
      events: [
        ...batch.events,
        {
          time: new Date().toISOString(),
          title: "Aksi dikonfirmasi",
          detail: (batch.jobSnapshot.steps || [])[batch.currentStep].action,
          tone: "blue",
        },
      ],
    });
    setSelectedMaterial("");
  };
  const confirmYes = (completionData?: {
    packagingCode: string;
    expiredDate: string;
    storageLocation: string;
    fillingDate: string;
    specialNotes: string;
    batchNo: string;
    actualMaterials?: Record<string, number>;
  }) => {
    if (!batch) return;
    stopActiveAudio();
    const notes = { ...batch.notes, [batch.currentStep]: note };
    const events = [
      ...batch.events,
      {
        time: new Date().toISOString(),
        title: `Step ${batch.currentStep + 1} selesai`,
        detail: note || "Sesuai instruksi",
        tone: "green" as const,
      },
    ];
    const isLast = batch.currentStep === (batch.jobSnapshot.steps || []).length - 1;
    if (isLast) {
      const nextBatch: Batch = {
        ...batch,
        stepState: "completed",
        status: "Completed",
        completedAt: Date.now(),
        output: output !== "" ? Number(output) : 0,
        notes,
        ...(completionData && {
          batch_no: completionData.batchNo,
          packaging_code: completionData.packagingCode,
          expired_date: completionData.expiredDate,
          storage_location: completionData.storageLocation,
          filling_date: completionData.fillingDate,
          special_notes: completionData.specialNotes,
          actual_materials: completionData.actualMaterials,
        }),
        events: [
          ...events,
          {
            time: new Date().toISOString(),
            title: "Batch selesai",
            detail: `Output ${output !== "" ? output : "0"} ${batch.jobSnapshot.unit}. Batch No: ${completionData?.batchNo || "-"}`,
            tone: "green",
          },
        ],
      };
      setBatch(nextBatch);
      persistBatch(nextBatch);
      triggerAudioEvent("job_completed", batch);
      setProcessAlert({
        kind: "complete",
        title: "Proses selesai",
        message: `Batch ${batch.id} selesai dengan output ${output !== "" ? output : "0"} ${batch.jobSnapshot.unit}.`,
      });
      createNotification(
        "admin",
        "Batch selesai",
        `${batch.id} selesai oleh ${batch.operator}.`,
        "success",
        "history",
      );
      setToast("Batch selesai dan tersimpan ke history.");
    } else {
      const next = batch.currentStep + 1;
      const durationSec = (batch.jobSnapshot.steps || [])[next]?.duration || 0;
      const stepEvents: BatchEvent[] = [
        ...events,
        {
          time: new Date().toISOString(),
          title: `Step ${next + 1} dimulai`,
          detail: (batch.jobSnapshot.steps || [])[next]?.title || `Proses step ${next + 1}`,
          tone: "blue",
        },
      ];
      const nextBatch: Batch = {
        ...batch,
        currentStep: next,
        stepState: "running",
        stepEndsAt: Date.now() + durationSec * 1000,
        pausedRemainingSeconds: undefined,
        notes,
        events: stepEvents,
      };
      setBatch(nextBatch);
      persistBatch(nextBatch);
      setNote("");
      setToast(
        `Step ${next + 1} otomatis berjalan.`,
      );
    }
  };

  const confirmNo = (noteOverride?: string) => {
    if (!batch) return;
    const finalNote = noteOverride || note;
    if (!finalNote.trim()) {
      setToast("Catatan wajib diisi sebelum memilih NO.");
      return;
    }
    stopActiveAudio();
    const remainingSec = Math.max(0, Math.ceil((batch.stepEndsAt - Date.now()) / 1000));
    const nextBatch: Batch = {
      ...batch,
      status: "Paused",
      stepState: "paused",
      pausedRemainingSeconds: remainingSec,
      notes: { ...batch.notes, [batch.currentStep]: finalNote },
      events: [
        ...batch.events,
        {
          time: new Date().toISOString(),
          title: `Step ${batch.currentStep + 1} dijeda`,
          detail: `[SISA:${remainingSec}s] ${finalNote || "Dihentikan sementara oleh operator"}`,
          tone: "orange",
        },
      ],
    };
    setBatch(nextBatch);
    persistBatch(nextBatch);
    triggerAudioEvent("paused", batch);
    setProcessAlert({
      kind: "paused",
      title: "Proses dijeda",
      message: `Kendala dicatat: ${finalNote}. Proses dijeda sementara.`,
    });
    for (const target of ["supervisor", "admin"] as const)
      createNotification(
        target,
        "Batch dijeda",
        `${batch.id}: ${note.trim()}`,
        "warning",
        "history",
      );
  };

  const operatorResume = () => {
    if (!batch) return;
    alarmedStep.current = "";
    const remainingSec = (batch.pausedRemainingSeconds !== undefined && batch.pausedRemainingSeconds > 0)
      ? batch.pausedRemainingSeconds 
      : ((batch.jobSnapshot.steps || [])[batch.currentStep]?.duration || 0);
    const nextBatch: Batch = {
      ...batch,
      status: "In Progress",
      stepState: remainingSec <= 0 ? "confirm" : "running",
      stepEndsAt: Date.now() + remainingSec * 1000,
      pausedRemainingSeconds: undefined,
      events: [
        ...batch.events,
        {
          time: new Date().toISOString(),
          title: `Step ${batch.currentStep + 1} dilanjutkan`,
          detail: `[SISA:${remainingSec}s] Operator melanjutkan proses yang dijeda.`,
          tone: "blue",
        },
      ],
    };
    setBatch(nextBatch);
    persistBatch(nextBatch);
    setOverrideType(null);
    setPin("");
    setReason("");
    setToast(
      "Otorisasi berhasil. Operator melanjutkan proses.",
    );
  };

  const supervisorPause = async (event: FormEvent) => {
    event.preventDefault();
    if (!batch) return;
    if (!pin.trim() || !reason.trim()) {
      setToast("PIN supervisor dan alasan wajib diisi.");
      return;
    }
    try {
      await apiFetch("/supervisor/verify-pin", {
        method: "POST",
        body: JSON.stringify({ pin }),
      });
      stopActiveAudio();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "PIN tidak valid");
      return;
    }
    const notes = { ...batch.notes, [batch.currentStep]: reason };
    const remainingSec = Math.max(0, Math.ceil((batch.stepEndsAt - Date.now()) / 1000));
    const events = [
      ...batch.events,
      {
        time: new Date().toISOString(),
        title: "Batch dijeda (Manual)",
        detail: `[SISA:${remainingSec}s] Supervisor: ${reason}`,
        tone: "orange" as const,
      },
    ];
    const nextBatch: Batch = {
      ...batch,
      status: "Paused",
      stepState: "paused",
      pausedRemainingSeconds: remainingSec,
      notes,
      events,
    };
    setBatch(nextBatch);
    persistBatch(nextBatch);
    triggerAudioEvent("paused", batch);
    setOverrideType(null);
    setPin("");
    setReason("");
    setToast("Otorisasi berhasil. Batch dijeda.");
    
    for (const target of ["supervisor", "admin"] as const) {
      createNotification(
        target,
        "Batch dijeda",
        `${batch.id}: ${reason}`,
        "warning",
        "history",
      );
    }
  };

  const supervisorManualResume = async (event: FormEvent) => {
    event.preventDefault();
    if (!batch) return;
    if (!pin.trim() || !reason.trim()) {
      setToast("PIN supervisor dan alasan wajib diisi.");
      return;
    }
    try {
      await apiFetch("/supervisor/verify-pin", {
        method: "POST",
        body: JSON.stringify({ pin }),
      });
    } catch (error) {
      setToast(error instanceof Error ? error.message : "PIN tidak valid");
      return;
    }
    alarmedStep.current = "";
    const remainingSec = (batch.pausedRemainingSeconds !== undefined && batch.pausedRemainingSeconds > 0)
      ? batch.pausedRemainingSeconds 
      : ((batch.jobSnapshot.steps || [])[batch.currentStep]?.duration || 0);
    const nextBatch: Batch = {
      ...batch,
      status: "In Progress",
      stepState: remainingSec <= 0 ? "confirm" : "running",
      stepEndsAt: Date.now() + remainingSec * 1000,
      pausedRemainingSeconds: undefined,
      events: [
        ...batch.events,
        {
          time: new Date().toISOString(),
          title: `Step ${batch.currentStep + 1} dilanjutkan (Manual)`,
          detail: `[SISA:${remainingSec}s] Supervisor: ${reason}`,
          tone: "blue" as const,
        },
      ],
    };
    setBatch(nextBatch);
    persistBatch(nextBatch);
    setOverrideType(null);
    setPin("");
    setReason("");
    setToast(
      "Otorisasi berhasil. Batch dilanjutkan.",
    );
  };

  const supervisorEarlyCompletion = async (event: FormEvent) => {
    event.preventDefault();
    if (!batch) return;
    if (!pin.trim() || !reason.trim()) {
      setToast("PIN supervisor dan alasan wajib diisi.");
      return;
    }
    try {
      await apiFetch("/supervisor/verify-pin", {
        method: "POST",
        body: JSON.stringify({ pin }),
      });
      stopActiveAudio();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "PIN tidak valid");
      return;
    }
    const notes = { ...batch.notes, [batch.currentStep]: note };
    const events = [
      ...batch.events,
      {
        time: new Date().toISOString(),
        title: "Early Completion (Override)",
        detail: `Supervisor: ${reason}`,
        tone: "orange" as const,
      },
    ];
    
    // Auto-advance step
    const nextBatch: Batch = {
      ...batch,
      stepState: "confirm",
      notes,
      events,
    };
    setBatch(nextBatch);
    persistBatch(nextBatch);
    setOverrideType(null);
    setPin("");
    setReason("");
    setToast("Otorisasi berhasil. Step diselesaikan lebih awal.");
  };

  const handleOverdriveConfirm = () => {
    if (!batch) return;
    stopActiveAudio();
    const isLast = batch.currentStep === (batch.jobSnapshot.steps || []).length - 1;
    const notes = { ...batch.notes, [batch.currentStep]: note };
    const step = (batch.jobSnapshot.steps || [])[batch.currentStep];
    const stepInfo = step ? `Step ${batch.currentStep + 1}: ${step.title || ""} - Instruksi: ${step.instruction || ""}` : `Step ${batch.currentStep + 1}`;
    if (isLast) {
      const events = [
        ...batch.events,
        {
          time: new Date().toISOString(),
          title: `Step ${batch.currentStep + 1} selesai (Overdrive)`,
          detail: `Operator melakukan overdrive pada step terakhir (${stepInfo}).`,
          tone: "orange" as const,
        },
      ];
      const nextBatch: Batch = {
        ...batch,
        stepState: "confirm",
        stepEndsAt: Date.now(),
        notes,
        events,
      };
      setBatch(nextBatch);
      persistBatch(nextBatch);
    } else {
      const next = batch.currentStep + 1;
      const durationSec = (batch.jobSnapshot.steps || [])[next]?.duration || 0;
      const nextStepInfo = (batch.jobSnapshot.steps || [])[next];
      const events: BatchEvent[] = [
        ...batch.events,
        {
          time: new Date().toISOString(),
          title: `Step ${batch.currentStep + 1} selesai (Overdrive)`,
          detail: `Operator melompati sisa waktu step (${stepInfo}).`,
          tone: "orange" as const,
        },
        {
          time: new Date().toISOString(),
          title: `Step ${next + 1} dimulai`,
          detail: nextStepInfo?.title || `Proses step ${next + 1}`,
          tone: "blue" as const,
        },
      ];
      const nextBatch: Batch = {
        ...batch,
        status: "In Progress",
        currentStep: next,
        stepState: "running",
        stepEndsAt: Date.now() + durationSec * 1000,
        pausedRemainingSeconds: undefined,
        notes,
        events,
      };
      setBatch(nextBatch);
      persistBatch(nextBatch);
      setNote("");
      setToast(`Step ${next + 1} otomatis berjalan via Overdrive.`);
    }
  };

  const adjustStepEndsAt = (remainingSec: number) => {
    if (!batch) return;
    const nextBatch: Batch = {
      ...batch,
      stepEndsAt: Date.now() + remainingSec * 1000,
    };
    setBatch(nextBatch);
    persistBatch(nextBatch);
  };

  const cancelActiveBatch = async (event: FormEvent) => {
    event.preventDefault();
    if (!batch || !role) return;
    try {
      const response = await apiFetch<{ cancelled_at: string }>(
        `/batches/${batch.id}/cancel`,
        {
          method: "POST",
          body: JSON.stringify({
            actor_role: role,
            actor_name: operatorName,
            pin: cancelPin,
            reason: cancelReason,
          }),
        },
      );
      const nextBatch: Batch = {
        ...batch,
        status: "Cancelled",
        completedAt: new Date(response.cancelled_at).getTime(),
        stepState: "paused",
        events: [
          ...batch.events,
          {
            time: response.cancelled_at,
            title: "Batch dibatalkan",
            detail: cancelReason,
            tone: "red",
          },
        ],
      };
      setBatch(nextBatch);
      setShowCancel(false);
      setCancelPin("");
      setCancelReason("");
      setView("home");
      triggerAudioEvent("stopped", batch);
      setToast("Job berhasil dibatalkan dan tercatat pada Batch History.");
    } catch (error) {
      setToast(
        error instanceof Error ? error.message : "Batch gagal dibatalkan",
      );
    }
  };

  useEffect(() => {
    if (!role || !authUser) return;
    const loadHistory = async () => {
      try {
        const params = new URLSearchParams({ from: "2026-01-01", to: new Date().toISOString().slice(0, 10) });
        if (role === "operator" && authUser.id) params.set("operator", authUser.id);
        const response = await apiFetch<{ data: Array<Record<string, unknown>> }>(`/batches?${params}`);
        setDbHistory(response.data.map((b) => ({
          id: String(b.id),
          job: String(b.job_name),
          operator: String(b.operator_name),
          area: String(b.area || ""),
          output: b.output != null ? `${b.output} ${b.unit}` : "-",
          status: String(b.status) as BatchStatus,
          date: new Date(String(b.started_at)).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }),
          duration: fmtClock(Number(b.actual_duration || 0)),
          rawBatch: b,
        })));
      } catch { /* offline */ }
    };
    void loadHistory();
  }, [role, authUser, batch?.status]);

  const filteredHistory = useMemo(() => {
    const q = reportQuery.toLowerCase();
    return dbHistory.filter((item) =>
      `${item.id} ${item.job} ${item.operator} ${item.status}`
        .toLowerCase()
        .includes(q),
    );
  }, [dbHistory, reportQuery]);

  const exportCsv = () => {
    const rows = [
      ["Batch No", "Job", "Operator", "Area", "Output", "Status", "Tanggal", "Durasi"],
      ...filteredHistory.map((item) => [
        item.id,
        item.job,
        item.operator,
        item.area || "-",
        item.output,
        item.status,
        item.date,
        item.duration,
      ]),
    ];
    const csv =
      "\uFEFF" +
      rows
        .map((row) =>
          row
            .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
            .join(","),
        )
        .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `Ringkasan_Produksi_${new Date().toISOString().slice(0, 10).replaceAll("-", "")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setToast("Report CSV berhasil dibuat.");
  };

  if (!hydrated)
    return (
      <div className="app-loader">
        <div className="loader-logo">
          <LogoMark />
        </div>
        <div className="spinner-border text-primary" role="status" />
        <p>Menyiapkan DWI Production...</p>
      </div>
    );
  if (!role) return <LoginScreen onLogin={login} />;

  const isAdmin = role === "admin" || role === "supervisor";

  return (
    <div className={`app-shell ${isAdmin ? "admin-shell" : "operator-shell"}`}>
      {!online && (
        <div className="offline-banner">
          <i className="bi bi-wifi-off" /> Jaringan terputus. Aksi akan tersedia
          kembali setelah koneksi pulih.
        </div>
      )}
      {isAdmin ? (
        <AdminSidebar active={view} setView={setView} role={role} roleName={authUser?.role_name || ""} authUser={authUser} />
      ) : null}
      <main className="app-main">
        <Topbar
          role={role}
          roleName={authUser?.role_name || ""}
          operatorName={operatorName}
          databaseOnline={databaseOnline}
          logout={logout}
          onNavigate={(target) => setView(target as View)}
          fullscreen={() => document.documentElement.requestFullscreen?.()}
          lowStockCount={lowStockItems.length}
          onOpenLowStockAlert={() => setShowLowStockModal(true)}
        />
        <div className="page-content">
          {isAdmin ? (
            <AdminContent
              role={role}
              view={view}
              setView={setView}
              jobs={jobs}
              setJobs={setJobs}
              batch={batch}
              history={filteredHistory}
              query={reportQuery}
              setQuery={setReportQuery}
              exportCsv={exportCsv}
              setToast={setToast}
              authUser={authUser}
              operatorName={operatorName}
              logout={logout}
              availableSounds={availableSounds}
            />
          ) : (
            <OperatorContent
              view={view}
              setView={setView}
              jobs={jobs}
              batch={batch}
              now={now}
              note={note}
              setNote={setNote}
              output={output}
              setOutput={setOutput}
              persistBatch={persistBatch}
              setBatch={setBatch}
              actualMaterials={actualMaterials}
              setActualMaterials={setActualMaterials}
              startJob={startJob}
              beginStep={beginStep}
              markAction={markAction}
              confirmYes={confirmYes}
              confirmNo={confirmNo}
              operatorResume={operatorResume}
              requestCancel={() => {
                setCancelReason("");
                setCancelPin("");
                setShowCancel(true);
              }}
              requestPause={() => {
                setReason("");
                setPin("");
                setOverrideType("pause");
              }}
              requestResume={() => {
                setReason("");
                setPin("");
                setOverrideType("resume");
              }}
              handleOverdriveConfirm={handleOverdriveConfirm}
              adjustStepEndsAt={adjustStepEndsAt}
              overdrivePausedRemaining={overdrivePausedRemaining}
              setOverdrivePausedRemaining={setOverdrivePausedRemaining}
              history={filteredHistory}
              operatorName={operatorName}
              authUser={authUser}
              logout={logout}
              setToast={setToast}
              masterAreas={masterAreas}
              masterLines={masterLines}
            />
          )}
        </div>
        {!isAdmin && (
          <OperatorNav
            active={view}
            setView={setView}
            hasActive={Boolean(batch && batch.status !== "Completed")}
          />
        )}
      </main>
      {toast && (
        <div className="app-toast">
          <i className="bi bi-check-circle-fill" />
          {toast}
        </div>
      )}
      {overrideType && batch && (
        <OverrideModal
          batch={batch}
          pin={pin}
          setPin={setPin}
          reason={reason}
          setReason={setReason}
          onSubmit={
            overrideType === "earlyCompletion"
              ? supervisorEarlyCompletion
              : overrideType === "pause"
                ? supervisorPause
                : supervisorManualResume
          }
          onClose={() => setOverrideType(null)}
          title={
            overrideType === "earlyCompletion"
              ? "Selesaikan Step Lebih Awal"
              : overrideType === "pause"
                ? "Pause Batch"
                : "Resume Batch"
          }
          text={
            overrideType === "earlyCompletion"
              ? `${batch.id} membutuhkan otorisasi supervisor untuk menyelesaikan step sebelum timer habis.`
              : overrideType === "pause"
                ? `${batch.id} membutuhkan otorisasi supervisor untuk dijeda.`
                : `${batch.id} membutuhkan otorisasi supervisor untuk dilanjutkan.`
          }
          reasonLabel={
            overrideType === "earlyCompletion"
              ? "Alasan Early Completion"
              : overrideType === "pause"
                ? "Alasan Pause Batch"
                : "Alasan Resume Batch"
          }
        />
      )}
      {showCancel && batch && role && (
        <CancelBatchModal
          batch={batch}
          role={role}
          pin={cancelPin}
          setPin={setCancelPin}
          reason={cancelReason}
          setReason={setCancelReason}
          onSubmit={cancelActiveBatch}
          onClose={() => setShowCancel(false)}
        />
      )}
      {showStartNotice && batch && (
        <StartNoticeModal
          setting={popupSetting}
          job={batch.jobSnapshot}
          acknowledged={startAcknowledged}
          setAcknowledged={setStartAcknowledged}
          onContinue={() => setShowStartNotice(false)}
        />
      )}
      {showLoginNotice && (
        <StartNoticeModal
          setting={popupSetting}
          acknowledged={startAcknowledged}
          setAcknowledged={setStartAcknowledged}
          onContinue={() => setShowLoginNotice(false)}
        />
      )}
      {showLowStockModal && (
        <LowStockModal
          items={lowStockItems}
          onClose={() => setShowLowStockModal(false)}
        />
      )}
      {processAlert && (
        <ProcessAlertModal
          alert={processAlert}
          onClose={() => {
            if (processAlert.kind === "expired" && batch) {
              const isLast = batch.currentStep === (batch.jobSnapshot.steps || []).length - 1;
              if (isLast) {
                const d = new Date();
                const ddmmyy = `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getFullYear()).slice(2)}`;
                const startedIso = (batch.startedAt && !isNaN(new Date(batch.startedAt).getTime()))
                  ? new Date(batch.startedAt).toISOString()
                  : new Date().toISOString();
                const handleComplete = (seq: number) => {
                  const code = (batch.jobSnapshot.product_code || "N/A").trim();
                  const bNo = `${ddmmyy} ${code}_${seq}`;
                  confirmYes({
                    packagingCode: "",
                    expiredDate: "",
                    storageLocation: "",
                    fillingDate: "",
                    specialNotes: "",
                    batchNo: bNo,
                    actualMaterials: {}
                  });
                };
                getProductionSeqOfToday(batch.id, batch.jobSnapshot.id, startedIso)
                  .then(handleComplete)
                  .catch((err) => {
                    console.error("Gagal getProductionSeqOfToday on alert expired:", err);
                    handleComplete(1);
                  });
              } else {
                confirmYes();
              }
            }
            setProcessAlert(null);
          }}
          onConfirmNo={(note) => {
            confirmNo(note);
          }}
        />
      )}
      {overdrivePausedRemaining !== null && (
        <div style={{ position: 'fixed', zIndex: 9999, top: 0, left: 0, right: 0, bottom: 0, display: 'grid', placeItems: 'center', background: 'rgba(4, 20, 43, 0.72)', backdropFilter: 'blur(4px)' }}>
          <div style={{ width: 'min(420px, 90vw)', background: 'white', padding: '32px', borderRadius: '18px', boxShadow: '0 24px 70px rgba(0,0,0,0.28)', position: 'relative', display: 'grid', gap: '14px' }}>
            <button
              type="button"
              onClick={() => { setOverdrivePausedRemaining(null); }}
              style={{ position: 'absolute', right: '14px', top: '14px', width: '34px', height: '34px', border: 0, borderRadius: '8px', background: '#f1f5f9', color: '#64748b', cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: '16px' }}
            >
              <i className="bi bi-x-lg" />
            </button>
            <p style={{ margin: 0, color: '#d97706', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>⚡ OVERDRIVE JOB</p>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Konfirmasi Overdrive</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px', lineHeight: 1.6 }}>
              Apakah kamu yakin sudah menyelesaikan step ini dan ingin menghentikan timer, lanjut ke step berikutnya?
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => { setOverdrivePausedRemaining(null); }}
                style={{ padding: '10px 22px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', color: '#334155', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}
              >
                Tidak
              </button>
              <button
                type="button"
                onClick={() => { handleOverdriveConfirm(); setOverdrivePausedRemaining(null); }}
                style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '14px', boxShadow: '0 6px 16px rgba(217,119,6,0.3)' }}
              >
                Ya, Overdrive!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LoginScreen({
  onLogin,
}: {
  onLogin: (username: string, password: string) => Promise<string | null>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Username dan password wajib diisi");
      return;
    }
    setError("");
    setLoading(true);
    const err = await onLogin(username, password);
    setLoading(false);
    if (err) setError(err);
  };

  const setPreset = (u: string, p = "automova") => {
    setUsername(u);
    setPassword(p);
    setError("");
  };

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand-content">
          <img src="/movacorp-logo-white.png" alt="Movacorp Logo" style={{ height: "54px", marginBottom: "2rem", alignSelf: "flex-start", objectFit: "contain" }} />
          <p className="eyebrow">CV AUTOMOVA DETAILING INDONESIA</p>
          <h1>
            Produksi lebih tertib.
            <br />
            Setiap batch terlacak.
          </h1>
          <p>
            Digital Work Instruction memandu operator menjalankan SOP, timer,
            konfirmasi, dan pencatatan produksi secara konsisten di jaringan
            lokal.
          </p>
          <div className="login-proof-grid">
            <div>
              <i className="bi bi-list-check" />
              <strong>Instruksi berurutan</strong>
              <span>Step terkunci sesuai SOP</span>
            </div>
            <div>
              <i className="bi bi-stopwatch" />
              <strong>Timer terkontrol</strong>
              <span>Alarm dan status real-time</span>
            </div>
            <div>
              <i className="bi bi-shield-check" />
              <strong>Traceability</strong>
              <span>Batch, operator, dan versi</span>
            </div>
          </div>
        </div>
      </section>
      <section className="login-form-panel">
        <div className="login-card">
          <div className="mobile-login-brand" style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem" }}>
            <img src="/movacorp-logo.png" alt="Movacorp Logo" style={{ height: "42px", objectFit: "contain" }} />
          </div>
          <p className="section-kicker">SELAMAT DATANG</p>
          <h2>Masuk ke sistem produksi</h2>
          <p className="muted">
            Masukkan kredensial pengguna Anda untuk melanjutkan.
          </p>

          <form className="login-auth-form" onSubmit={handleSubmit}>
            {error && (
              <div className="login-error-alert">
                <i className="bi bi-exclamation-triangle-fill" />
                <span>{error}</span>
              </div>
            )}
            <div className="login-field">
              <label htmlFor="login-username">Username</label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Contoh: budi, yogi, suganda"
                autoComplete="username"
                disabled={loading}
              />
            </div>
            <div className="login-field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                autoComplete="current-password"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              className="login-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" />
                  Memverifikasi...
                </>
              ) : (
                <>
                  <i className="bi bi-box-arrow-in-right" /> Masuk ke Aplikasi
                </>
              )}
            </button>
          </form>
          <p className="login-footer" style={{ marginTop: "24px" }}>AUTOMOVA DWI Production v1.0</p>
        </div>
      </section>
    </main>
  );
}

function Topbar({
  role,
  roleName,
  operatorName,
  databaseOnline,
  logout,
  onNavigate,
  fullscreen,
  lowStockCount = 0,
  onOpenLowStockAlert,
}: {
  role: Role;
  roleName?: string;
  operatorName: string;
  databaseOnline: boolean;
  logout: () => void;
  onNavigate: (view: string) => void;
  fullscreen: () => void;
  lowStockCount?: number;
  onOpenOpenStockAlert?: () => void;
  onOpenLowStockAlert?: () => void;
}) {
  const [menu, setMenu] = useState(false);
  return (
    <header className="topbar">
      <div className="mobile-brand" style={{ display: "flex", alignItems: "center" }}>
        <img src={role === "operator" ? "/movacorp-logo-white.png" : "/movacorp-logo.png"} alt="Movacorp Logo" style={{ height: "38px", objectFit: "contain" }} />
      </div>
      <div className="topbar-context">
        <span className={`connection-pill ${databaseOnline ? "" : "offline"}`}>
          <span />{" "}
          {databaseOnline ? "Database LAN Connected" : "Database API Offline"}
        </span>
      </div>
      <div className="topbar-actions">
        {(role === "admin" || role === "supervisor") && (
          <button
            className="icon-btn stock-alert-btn"
            style={{ 
              position: 'relative', 
              background: lowStockCount > 0 ? '#fef08a' : undefined, 
              color: lowStockCount > 0 ? '#ca8a04' : undefined,
              borderRadius: '8px',
              padding: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: 'pointer'
            }}
            onClick={onOpenLowStockAlert}
            aria-label="Alert Material"
          >
            <i className={`bi ${lowStockCount > 0 ? 'bi-bell-fill' : 'bi-bell'}`} style={{ fontSize: '18px' }} />
            {lowStockCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                backgroundColor: '#ef4444',
                color: '#fff',
                borderRadius: '50%',
                padding: '2px 5px',
                fontSize: '9px',
                fontWeight: 'bold',
                lineHeight: 1
              }}>
                {lowStockCount}
              </span>
            )}
          </button>
        )}
        <button
          className="icon-btn"
          aria-label="Mode layar penuh"
          onClick={fullscreen}
        >
          <i className="bi bi-arrows-fullscreen" />
        </button>
        <NotificationCenter role={role} onNavigate={onNavigate} />
        <button className="profile-button" onClick={() => setMenu(!menu)}>
          <span className="avatar">
            {operatorName
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")}
          </span>
          <span>
            <strong>{operatorName}</strong>
            <small>{roleName || (role[0].toUpperCase() + role.slice(1))}</small>
          </span>
          <i className="bi bi-chevron-down" />
        </button>
        {menu && (
          <div className="profile-menu">
            <button
              onClick={() => {
                setMenu(false);
                onNavigate("account");
              }}
            >
              <i className="bi bi-person-circle" /> Profil Saya
            </button>
            <button onClick={logout}>
              <i className="bi bi-box-arrow-right" /> Keluar
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function AdminSidebar({
  active,
  setView,
  role,
  roleName,
  authUser,
}: {
  active: View;
  setView: (view: View) => void;
  role: Role;
  roleName?: string;
  authUser: AuthUser | null;
}) {
  const visibleGroups = NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => hasViewPermission(item.view, authUser, role))
  })).filter(group => group.items.length > 0);

  return (
    <aside className="admin-sidebar">
      <div className="sidebar-brand" style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "1.5rem 1rem", justifyContent: "flex-start" }}>
        <img src="/movacorp-logo-white.png" alt="Movacorp Logo" style={{ height: "46px", objectFit: "contain" }} />
      </div>
      <div style={{ overflowY: "auto", flex: 1, paddingBottom: "1rem" }}>
        {visibleGroups.map((group) => (
          <div key={group.title}>
            <p className="sidebar-label" style={{ marginTop: "1.5rem" }}>{group.title}</p>
            <nav>
              {group.items.map((item) => (
                <button
                  key={item.view}
                  className={active === item.view ? "active" : ""}
                  onClick={() => setView(item.view)}
                >
                  <i className={`bi ${item.icon}`} />
                  <span>{item.label}</span>
                  
                </button>
              ))}
            </nav>
          </div>
        ))}
      </div>
      <div className="sidebar-bottom">
        <div className="system-card">
          <p>
            <span className="pulse-dot" /> Sistem Terhubung
          </p>
          <small>Server lokal · Sinkron</small>
          <small>Backup terakhir: 22 Jul, 02:00</small>
        </div>
        <span className="role-chip">
          <i className="bi bi-shield-check" /> Mode{" "}
          {roleName || (role === "admin" ? "Admin" : "Supervisor")}
        </span>
      </div>
    </aside>
  );
}

function OperatorNav({
  active,
  setView,
  hasActive,
}: {
  active: View;
  setView: (view: View) => void;
  hasActive: boolean;
}) {
  const items: Array<{ view: View; icon: string; label: string }> = [
    { view: "home", icon: "bi-house-door-fill", label: "Home" },
    { view: "active", icon: "bi-clipboard2-check", label: "Active Job" },
    { view: "history", icon: "bi-clock-history", label: "History" },
    { view: "account", icon: "bi-person", label: "Account" },
  ];
  return (
    <nav className="operator-nav">
      {items.map((item) => (
        <button
          key={item.view}
          className={active === item.view ? "active" : ""}
          onClick={() => setView(item.view)}
        >
          <span>
            <i className={`bi ${item.icon}`} />
            {item.view === "active" && hasActive && <em />}
          </span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function OperatorContent(props: {
  view: View;
  setView: (view: View) => void;
  jobs: Job[];
  batch: Batch | null;
  now: number;
  note: string;
  setNote: (value: string) => void;
  output: string;
  setOutput: (value: string) => void;
  persistBatch: (value: Batch) => void;
  setBatch: (value: Batch | null) => void;
  actualMaterials: Record<string, number>;
  setActualMaterials: (value: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
  startJob: (job: Job, selectedArea?: string, selectedLine?: string) => void;
  beginStep: () => void;
  markAction: () => void;
  confirmYes: (completionData?: any) => void;
  confirmNo: () => void;
  requestCancel: () => void;
  requestPause: () => void;
  requestResume: () => void;
  handleOverdriveConfirm: () => void;
  adjustStepEndsAt: (remainingSec: number) => void;
  overdrivePausedRemaining: number | null;
  setOverdrivePausedRemaining: (v: number | null) => void;
  history: HistoryRow[];
  operatorName: string;
  authUser: AuthUser | null;
  logout: () => void;
  setToast: (msg: string) => void;
  masterAreas: { id: string; name: string }[];
  masterLines?: { id: string; name: string; area_id: string }[];
  operatorResume: () => void;
}) {
  const {
    view,
    setView,
    jobs,
    batch,
    now,
    note,
    setNote,
    output,
    setOutput,
    persistBatch,
    setBatch,
    actualMaterials,
    setActualMaterials,
    startJob,
    beginStep,
    markAction,
    confirmYes,
    confirmNo,
    requestCancel,
    requestPause,
    requestResume,
    history,
    operatorName,
    logout,
    masterAreas,
    masterLines = [],
    handleOverdriveConfirm,
    adjustStepEndsAt,
    overdrivePausedRemaining,
    setOverdrivePausedRemaining,
  } = props;
  if (view === "active")
    return (
      <ActiveBatch
        batch={batch}
        now={now}
        note={note}
        setNote={setNote}
        output={output}
        setOutput={setOutput}
        persistBatch={persistBatch}
        setBatch={setBatch}
        actualMaterials={actualMaterials}
        setActualMaterials={setActualMaterials}
        beginStep={beginStep}
        markAction={markAction}
        confirmYes={confirmYes}
        confirmNo={confirmNo}
        requestCancel={requestCancel}
        requestPause={requestPause}
        requestResume={requestResume}
        operatorResume={props.operatorResume}
        handleOverdriveConfirm={handleOverdriveConfirm}
        adjustStepEndsAt={adjustStepEndsAt}
        overdrivePausedRemaining={overdrivePausedRemaining}
        setOverdrivePausedRemaining={setOverdrivePausedRemaining}
        setView={setView}
      />
    );
  if (view === "history") return <OperatorHistory history={history} jobs={jobs} />;
  if (view === "account")
    return (
      <AccountCard
        authUser={props.authUser}
        operatorName={operatorName}
        logout={logout}
        setToast={props.setToast}
      />
    );
  return (
    <OperatorHome
      operatorName={operatorName}
      jobs={jobs}
      batch={batch}
      startJob={startJob}
      setView={setView}
      operatorResume={props.operatorResume}
      masterAreas={masterAreas}
      masterLines={masterLines}
    />
  );
}

function OperatorHome({
  operatorName,
  jobs,
  batch,
  startJob,
  setView,
  operatorResume,
  masterAreas = [],
  masterLines = [],
}: {
  operatorName: string;
  jobs: Job[];
  batch: Batch | null;
  startJob: (job: Job, selectedArea: string, selectedLine: string) => void;
  setView: (view: View) => void;
  operatorResume: () => void;
  masterAreas: { id: string; name: string }[];
  masterLines?: { id: string; name: string; area_id: string }[];
}) {
  const [jobSearch, setJobSearch] = useState("");
  const [pendingJob, setPendingJob] = useState<Job | null>(null);
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedLine, setSelectedLine] = useState("");
  const active =
    batch && batch.status !== "Completed" && batch.status !== "Cancelled"
      ? batch
      : null;
  const firstName = operatorName ? operatorName.split(" ")[0] : "Operator";
  const filteredJobs = useMemo(
    () =>
      jobs.filter(
        (job) =>
          job.status === "Published" &&
          `${job.name} ${job.product} ${job.area}`
            .toLowerCase()
            .includes(jobSearch.toLowerCase()),
      ),
    [jobs, jobSearch],
  );

  return (
    <div className="operator-container">
      <section className="welcome-row">
        <div>
          <p className="section-kicker">PRODUCTION OPERATOR</p>
          <h1>Selamat bekerja, {firstName}</h1>
          <p>Ikuti setiap instruksi dan pastikan semua tahap dikonfirmasi.</p>
        </div>
        <div className="date-card">
          <i className="bi bi-calendar3" />
          <span>
            <small>Hari ini</small>
            <strong>
              {new Date().toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </strong>
          </span>
        </div>
      </section>
      {active && (
        <section
          className={`active-resume-card ${active.status === "Paused" ? "paused" : ""}`}
        >
          <div className="resume-icon">
            <i
              className={`bi ${active.status === "Paused" ? "bi-pause-fill" : "bi-play-fill"}`}
            />
          </div>
          <div>
            <span className="card-label">
              {active.status === "Paused"
                ? "MEMBUTUHKAN PERHATIAN"
                : "BATCH AKTIF"}
            </span>
            <h2>{active.jobSnapshot.name}</h2>
            <p>
              {active.id} · Step {active.currentStep + 1} dari{" "}
              {(active.jobSnapshot.steps || []).length}
            </p>
          </div>
          <div className="resume-progress">
            <span>
              {Math.round(
                (active.currentStep / (active.jobSnapshot.steps || []).length) * 100,
              )}
              %
            </span>
            <div>
              <i
                style={{
                  width: `${Math.max(8, (active.currentStep / (active.jobSnapshot.steps || []).length) * 100)}%`,
                }}
              />
            </div>
          </div>
            {active.status === "Paused" || active.status === "In Progress" ? (
              <button
                className="btn btn-primary btn-lg"
                onClick={() => setView("active")}
              >
                Lanjutkan Job
                <i className="bi bi-arrow-right" />
              </button>
            ) : null}
        </section>
      )}
      <div className="content-heading">
        <div>
          <p className="section-kicker">JOB TERSEDIA</p>
          <h2>Pilih instruksi kerja</h2>
        </div>
        <div className="search-box">
          <i className="bi bi-search" />
          <input
            aria-label="Cari job"
            value={jobSearch}
            onChange={(e) => setJobSearch(e.target.value)}
            placeholder="Cari Job atau produk..."
          />
        </div>
      </div>
      <div className="operator-job-grid">
        {filteredJobs.map((job, index) => (
            <article className="job-card" key={job.id}>
              <div className={`job-visual tone-${index}`}>
                <i
                  className={`bi ${index === 0 ? "bi-droplet-half" : index === 1 ? "bi-fan" : "bi-water"}`}
                />
              </div>
              <div className="job-card-body">
                <div className="job-title-row">
                  <div>
                    <span className="category-chip">{job.area}</span>
                    <h3>{job.name}</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span className="version-chip">v{job.version}</span>
                    <strong style={{ fontSize: '18px', color: 'var(--navy)', letterSpacing: '1px' }}>{job.product_code || "-"}</strong>
                  </div>
                </div>
                <div className="job-meta-grid">
                  <span>
                    <small>Produk</small>
                    <strong>{job.product}</strong>
                  </span>
                  <span>
                    <small>Target</small>
                    <strong>
                      {job.target} {job.unit}
                    </strong>
                  </span>
                  <span>
                    <small>Jumlah Step</small>
                    <strong>{(job.steps || []).length} Tahap</strong>
                  </span>
                  <span>
                    <small>Shift</small>
                    <strong>{job.shift.split(" (")[0]}</strong>
                  </span>
                </div>
                <button
                  className="job-start-button"
                  style={active ? { background: '#fff3cd', color: '#664d03', borderColor: '#ffecb5' } : {}}
                  onClick={() => {
                    if (active) {
                      window.alert("PERHATIAN!\n\nAnda masih memiliki pekerjaan yang sedang berjalan (Batch Aktif).\n\nSilakan selesaikan atau batalkan pekerjaan tersebut terlebih dahulu sebelum memilih pekerjaan baru.");
                      setView("active");
                    } else {
                      setPendingJob(job);
                      // Auto-select area and line based on the job's line if available
                      const matchingLine = masterLines.find(l => l.name === job.line);
                      if (matchingLine) {
                        setSelectedLine(matchingLine.name);
                        const matchingArea = masterAreas.find(a => a.id === matchingLine.area_id);
                        setSelectedArea(matchingArea ? matchingArea.name : (masterAreas.length > 0 ? masterAreas[0].name : ""));
                      } else {
                        setSelectedLine("");
                        setSelectedArea(masterAreas.length > 0 ? masterAreas[0].name : "");
                      }
                    }
                  }}
                >
                  <i className={active ? "bi bi-exclamation-triangle-fill" : "bi bi-play-circle"} />{" "}
                  {active ? "Pekerjaan Sedang Aktif" : "Pilih Job"}{" "}
                  {!active && <i className="bi bi-arrow-right" />}
                </button>
              </div>
            </article>
          ))}
      </div>
      <div className="info-strip">
        <i className="bi bi-info-circle" />
        <span>
          <strong>Instruksi kerja tersinkron otomatis</strong>
          <small>
            Job dan versi terbaru akan tersedia tanpa instalasi ulang pada
            perangkat.
          </small>
        </span>
      </div>
      
      {pendingJob && (
        <div className="modal-backdrop-custom">
          <div className="override-modal" style={{ maxWidth: '400px' }}>
            <button
              type="button"
              className="modal-close"
              onClick={() => setPendingJob(null)}
              aria-label="Tutup"
            >
              <i className="bi bi-x-lg" />
            </button>
            <p className="section-kicker">MULAI BATCH</p>
            <h2>Pilih Area & Mesin</h2>
            <p style={{ color: "var(--muted)", fontSize: "14px", marginTop: "-6px" }}>
              Tentukan area dan mesin/line tempat Anda memproses job <strong>{pendingJob.name}</strong> ini.
            </p>
            <label style={{ display: "block", marginBottom: "8px" }}>
              Area Produksi
              <select
                value={selectedArea}
                onChange={(e) => {
                  const areaName = e.target.value;
                  setSelectedArea(areaName);
                  const areaObj = masterAreas.find(a => a.name === areaName);
                  const firstLine = areaObj ? masterLines.find(l => l.area_id === areaObj.id) : null;
                  setSelectedLine(firstLine ? firstLine.name : "");
                }}
                style={{ width: "100%", padding: "10px", marginTop: "6px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--canvas)", color: "var(--text)" }}
              >
                <option value="" disabled>-- Pilih Area --</option>
                {masterAreas.map((a) => (
                  <option key={a.id} value={a.name}>{a.name}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "block", marginBottom: "8px" }}>
              Mesin / Line
              <select
                value={selectedLine}
                onChange={(e) => setSelectedLine(e.target.value)}
                style={{ width: "100%", padding: "10px", marginTop: "6px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--canvas)", color: "var(--text)" }}
              >
                <option value="" disabled>-- Pilih Line/Mesin --</option>
                {masterLines
                  .filter(l => {
                    const areaObj = masterAreas.find(a => a.name === selectedArea);
                    return areaObj ? l.area_id === areaObj.id : true;
                  })
                  .map((l) => (
                    <option key={l.id} value={l.name}>{l.name}</option>
                  ))}
              </select>
            </label>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "12px" }}>
              <button type="button" className="btn btn-light" onClick={() => setPendingJob(null)}>Batal</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!selectedArea || !selectedLine}
                onClick={() => {
                  if (pendingJob) {
                    startJob(pendingJob, selectedArea, selectedLine);
                    setPendingJob(null);
                  }
                }}
              >
                Mulai Pekerjaan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActiveBatch({
  batch,
  now,
  note,
  setNote,
  output,
  setOutput,
  persistBatch,
  setBatch,
  actualMaterials,
  setActualMaterials,
  beginStep,
  markAction,
  confirmYes,
  confirmNo,
  requestCancel,
  requestPause,
  requestResume,
  operatorResume,
  handleOverdriveConfirm,
  adjustStepEndsAt,
  setView,
  overdrivePausedRemaining,
  setOverdrivePausedRemaining,
}: {
  batch: Batch | null;
  now: number;
  note: string;
  setNote: (value: string) => void;
  output: string;
  setOutput: (value: string) => void;
  persistBatch: (value: Batch) => void;
  setBatch: (value: Batch | null) => void;
  actualMaterials: Record<string, number>;
  setActualMaterials: (value: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
  beginStep: () => void;
  markAction: () => void;
  confirmYes: (completionData?: any) => void;
  confirmNo: () => void;
  requestCancel: () => void;
  requestPause: () => void;
  requestResume: () => void;
  handleOverdriveConfirm: () => void;
  adjustStepEndsAt: (remainingSec: number) => void;
  operatorResume: () => void;
  setView: (view: View) => void;
  overdrivePausedRemaining: number | null;
  setOverdrivePausedRemaining: (v: number | null) => void;
}) {
  const [packagingCode, setPackagingCode] = useState("");
  const [expiredDate, setExpiredDate] = useState("");
  const [storageLocation, setStorageLocation] = useState("");
  const [fillingDate, setFillingDate] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [packagings, setPackagings] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/master_packaging")
      .then(res => res.json())
      .then(data => setPackagings(data.data || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (batch) {
      setPackagingCode("");
      setExpiredDate("");
      setStorageLocation("");
      setFillingDate("");
      setSpecialNotes("");
    }
  }, [batch?.id]);

  if (!batch)
    return (
      <EmptyState
        icon="bi-clipboard2"
        title="Belum ada Job aktif"
        text="Pilih Job dari halaman Home untuk memulai batch baru."
        action="Pilih Job"
        onAction={() => setView("home")}
      />
    );
  const step = (batch.jobSnapshot.steps || [])[batch.currentStep];
  const remaining =
    batch.stepState === "paused" && batch.pausedRemainingSeconds !== undefined
      ? batch.pausedRemainingSeconds
      : batch.stepState === "ready"
      ? step.duration
      : Math.max(0, Math.ceil((batch.stepEndsAt - now) / 1000));
  const displayRemaining = overdrivePausedRemaining !== null ? overdrivePausedRemaining : remaining;
  const progress =
    ((batch.currentStep + (batch.stepState === "completed" ? 1 : 0)) /
      (batch.jobSnapshot.steps || []).length) *
    100;
  const totalDuration = (batch.jobSnapshot.steps || []).reduce((sum, s) => sum + s.duration, 0);
  const remainingTotal = (batch.jobSnapshot.steps || []).slice(batch.currentStep).reduce((sum, s, idx) => {
    if (idx === 0) {
      return sum + displayRemaining;
    }
    return sum + s.duration;
  }, 0);
  const elapsedTotal = totalDuration - remainingTotal;
  const timeProgressPercent = totalDuration > 0 ? Math.min(100, Math.max(0, (elapsedTotal / totalDuration) * 100)) : 0;
  if (batch.status === "Completed")
    return <CompletionCard batch={batch} setView={setView} persistBatch={persistBatch} setBatch={setBatch} />;
  return (
    <div className="active-page operator-container">
      {batch.jobSnapshot.popupEnabled && (batch.jobSnapshot.popupTitle || batch.jobSnapshot.popupMessage) && (
        <div className="alert alert-warning" style={{ margin: '16px 16px 0', borderLeft: '4px solid #ffc107', borderRadius: '4px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: '1.25rem', color: '#856404' }}></i>
            <div>
              <strong style={{ display: 'block', color: '#856404' }}>PENGINGAT KHUSUS: {batch.jobSnapshot.popupTitle}</strong>
              <span style={{ color: '#856404', fontSize: '0.9rem' }}>{batch.jobSnapshot.popupMessage}</span>
            </div>
          </div>
        </div>
      )}
      <div className="batch-header" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', padding: '12px', background: '#e0f2fe', borderRadius: '8px', color: '#0369a1', minWidth: '80px', textAlign: 'center' }}>
          <i className="bi bi-droplet-half" style={{ fontSize: '1.5rem', marginBottom: '4px' }} />
          <strong style={{ fontSize: '1.2rem', lineHeight: 1 }}>{batch.jobSnapshot.product_code || "N/A"}</strong>
        </div>
        <div style={{ flex: 1 }}>
          <span className="card-label">ACTIVE PRODUCTION</span>
          <h1 style={{ fontSize: '1.25rem', margin: '4px 0' }}>{batch.jobSnapshot.name}</h1>
          <p style={{ margin: 0 }}>
            Batch No · <strong>{batch.id}</strong>
          </p>
        </div>
        <div className="batch-progress">
          <div>
            <span>
              Step {batch.currentStep + 1} / {(batch.jobSnapshot.steps || []).length}
            </span>
            <strong>{Math.round(progress)}%</strong>
          </div>
          <div className="progress-track">
            <i style={{ width: `${Math.max(7, progress)}%` }} />
          </div>
        </div>
        <StatusBadge status={batch.status} />
      </div>
      <div
        className={`step-workspace ${batch.status === "Paused" ? "is-paused" : ""}`}
      >
        <section className="instruction-panel">
          <div className="step-number">STEP {batch.currentStep + 1}</div>
          <h2>{step.title}</h2>
          <p className="instruction-copy">{step.instruction}</p>
          <div className="warning-box">
            <i className="bi bi-exclamation-triangle-fill" />
            <span>
              <strong>Perhatikan</strong>
              {step.warning}
            </span>
          </div>
          {batch.stepState === "ready" ? (
            <button
              className="main-action start-timer-action"
              onClick={beginStep}
            >
              <i className="bi bi-play-circle-fill" /> Mulai Step & Timer
            </button>
          ) : batch.status === "Paused" ? (
            <button
              className="main-action"
              onClick={operatorResume}
              style={{ background: '#0ea5e9', color: '#fff', border: 'none' }}
            >
              <i className="bi bi-play-circle-fill" /> Lanjutkan Job
            </button>
          ) : batch.stepState === "confirm" ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
              {batch.currentStep === (batch.jobSnapshot.steps || []).length - 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '24px', borderRadius: '16px' }}>
                  {/* Card 1: Hasil Produksi Aktual */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#ffffff', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontSize: '15px', color: '#1e293b', margin: 0, width: '100%', cursor: 'default' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="bi bi-box-seam" style={{ color: '#3b82f6', fontSize: '18px' }} />
                        Hasil Produksi Aktual
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="number"
                          value={output}
                          onChange={(e) => setOutput(e.target.value)}
                          style={{ width: '120px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 600, fontSize: '15px', background: '#fff', color: '#0f172a' }}
                        />
                        <span style={{ fontWeight: 600, color: '#64748b' }}>{batch.jobSnapshot.unit}</span>
                      </div>
                    </label>
                  </div>
                  
                  {/* Card 2: Konfirmasi Penggunaan Material */}
                  {batch.jobSnapshot.materials && batch.jobSnapshot.materials.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#ffffff', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                        <i className="bi bi-boxes" style={{ color: '#f59e0b', fontSize: '18px' }} />
                        <strong style={{ fontSize: '14px', color: '#1e293b' }}>Konfirmasi Penggunaan Material</strong>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                        {batch.jobSnapshot.materials.map(m => (
                          <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{m.code || m.name}</span>
                              {m.code && <span style={{ fontSize: '11px', color: '#64748b' }}>{m.name}</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input 
                                type="number" 
                                step="0.01"
                                style={{ width: '80px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 600, fontSize: '13px', background: '#fff', color: '#0f172a' }}
                                value={actualMaterials[m.id] ?? m.qty}
                                onChange={(e) => setActualMaterials(prev => ({ ...prev, [m.id]: Number(e.target.value) }))}
                              />
                              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, width: '30px' }}>{m.unit}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Card 3: Detail Kemasan & Logistik */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: '#ffffff', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                      <i className="bi bi-file-earmark-text" style={{ color: '#10b981', fontSize: '18px' }} />
                      <strong style={{ fontSize: '14px', color: '#1e293b' }}>Detail Kemasan & Penyimpanan</strong>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                        Kemasan (Packaging Code)
                        <select 
                          value={packagingCode} 
                          onChange={(e) => setPackagingCode(e.target.value)}
                          style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px', fontWeight: 500, color: '#0f172a' }}
                        >
                          <option value="">-- Pilih Kemasan --</option>
                          {packagings.map(p => (
                            <option key={p.id} value={p.code}>{p.name} ({p.code})</option>
                          ))}
                        </select>
                      </label>

                      <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                        Lokasi Penyimpanan
                        <input 
                          type="text" 
                          placeholder="Misal: Gudang A"
                          value={storageLocation} 
                          onChange={(e) => setStorageLocation(e.target.value)} 
                          style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 500, background: '#fff', color: '#0f172a' }}
                        />
                      </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                        Tanggal Filling
                        <input 
                          type="date" 
                          value={fillingDate} 
                          onChange={(e) => setFillingDate(e.target.value)} 
                          style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 500, background: '#fff', color: '#0f172a' }}
                        />
                      </label>
                    </div>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                      Catatan Khusus Batch (Opsional)
                      <textarea 
                        placeholder="Masukkan catatan khusus jika ada..."
                        value={specialNotes} 
                        onChange={(e) => setSpecialNotes(e.target.value)} 
                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 500, minHeight: '80px', resize: 'vertical', background: '#fff', color: '#0f172a' }}
                      />
                    </label>
                  </div>
                </div>
              )}
              <button
                className="main-action"
                style={{ background: '#22c55e', color: '#fff', border: 'none', boxShadow: '0 8px 18px rgba(34, 197, 94, 0.24)' }}
                onClick={() => {
                  if (batch.currentStep === (batch.jobSnapshot.steps || []).length - 1) {
                    const fillingVal = fillingDate && !isNaN(new Date(fillingDate).getTime())
                      ? fillingDate
                      : new Date().toISOString().slice(0, 10);
                    const d = new Date(fillingVal);
                    const ddmmyy = `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getFullYear()).slice(2)}`;
                    const startedIso = (batch.startedAt && !isNaN(new Date(batch.startedAt).getTime()))
                      ? new Date(batch.startedAt).toISOString()
                      : new Date().toISOString();

                    const handleComplete = (seq: number) => {
                      const code = (batch.jobSnapshot.product_code || "").trim();
                      const bNo = `${ddmmyy} ${code}_${seq}`;
                      confirmYes({
                        packagingCode,
                        expiredDate,
                        storageLocation,
                        fillingDate: fillingVal,
                        specialNotes,
                        batchNo: bNo,
                        actualMaterials
                      });
                    };

                    getProductionSeqOfToday(batch.id, batch.jobSnapshot.id, startedIso)
                      .then(handleComplete)
                      .catch((err) => {
                        console.error("Gagal mendeteksi sekuens produksi:", err);
                        handleComplete(1);
                      });
                  } else {
                    confirmYes();
                  }
                }}
              >
                <i className="bi bi-check2-circle" />
                {batch.currentStep === (batch.jobSnapshot.steps || []).length - 1
                  ? "Selesaikan Batch"
                  : "Lanjutkan Step Berikutnya"}
              </button>
            </div>
          ) : (
            (remaining === 0 || step.allow_overdrive !== false) ? (
              <button
                className="main-action"
                disabled={batch.stepState !== "running"}
                onClick={remaining > 0 ? () => setOverdrivePausedRemaining(remaining) : markAction}
                style={remaining > 0 ? { background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', border: 'none', boxShadow: '0 8px 18px rgba(217, 119, 6, 0.24)' } : {}}
              >
                <i className={remaining > 0 ? "bi bi-lightning-charge-fill" : "bi bi-check2-circle"} />
                {remaining > 0 ? "Overdrive Job" : step.action}
              </button>
            ) : null
          )}
        </section>
        <aside
          className={`timer-panel ${batch.stepState === "confirm" ? "timer-finished" : ""} ${batch.stepState === "ready" ? "timer-ready" : ""}`}
        >
          <p>{batch.stepState === "ready" ? "DURASI STEP" : "WAKTU TERSISA"}</p>
          <div
            className="timer-ring"
            style={
              {
                "--timer-progress": `${Math.max(5, Math.round((displayRemaining / step.duration) * 100)) * 3.6}deg`,
              } as React.CSSProperties
            }
          >
            <div>
              <strong>{fmtClock(displayRemaining)}</strong>
              <span>dari {fmtClock(step.duration)}</span>
            </div>
          </div>
          <span className="timer-status">
            <i
              className={`bi ${batch.stepState === "ready" ? "bi-hand-index-thumb" : batch.stepState === "running" ? "bi-hourglass-split" : "bi-bell-fill"}`}
            />
            {batch.stepState === "ready"
              ? "Menunggu operator menekan Mulai"
              : batch.stepState === "running"
                ? "Timer sedang berjalan"
                : batch.stepState === "paused"
                  ? "Timer dijeda"
                  : "Menunggu konfirmasi"}
          </span>

          <div style={{ marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '16px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
              <span>Total Estimasi Waktu</span>
              <span style={{ color: '#0f172a' }}>{fmtClock(totalDuration)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>
              <span>Sisa Waktu Kerja</span>
              <span style={{ color: '#0f172a', fontWeight: 700 }}>{fmtClock(remainingTotal)}</span>
            </div>
            
            <div style={{ position: 'relative', width: '100%', background: '#f1f5f9', borderRadius: '8px', height: '14px', overflow: 'hidden', display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0' }}>
              <div style={{ width: `${timeProgressPercent}%`, background: 'linear-gradient(90deg, #3b82f6, #10b981)', height: '100%', transition: 'width 0.5s ease-in-out' }} />
              <span style={{ position: 'absolute', width: '100%', textAlign: 'center', fontSize: '10px', fontWeight: 700, color: timeProgressPercent > 55 ? '#fff' : '#1e293b', pointerEvents: 'none' }}>
                {Math.round(timeProgressPercent)}% Waktu Berlalu
              </span>
            </div>
          </div>
        </aside>
      </div>
      <div className="step-footer">
        <div>
          <span>
            <i className="bi bi-box" /> Product
            <strong>{batch.jobSnapshot.product}</strong>
          </span>
          <span>
            <i className="bi bi-clock" /> Mulai
            <strong>{fmtDate(batch.startedAt)}</strong>
          </span>
          <span>
            <i className="bi bi-people" /> Shift
            <strong>{batch.jobSnapshot.shift}</strong>
          </span>
          <span>
            <i className="bi bi-diagram-3" /> Job Version
            <strong>v{batch.jobSnapshot.version} (Snapshot)</strong>
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {batch.status === "Paused" || batch.stepState === "paused" ? (
            <button
              className="resume-job-button"
              onClick={requestResume}
              style={{
                background: '#10b981',
                color: '#fff',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              <i className="bi bi-play-circle" />
              Resume Job
            </button>
          ) : (
            <button
              className="pause-job-button"
              onClick={requestPause}
              style={{
                background: '#f59e0b',
                color: '#fff',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              <i className="bi bi-pause-circle" />
              Pause Job
            </button>
          )}
          <button className="cancel-job-button" onClick={requestCancel}>
            <i className="bi bi-x-octagon" />
            Batalkan Job
          </button>
        </div>
      </div>
    </div>
  );
}

function CompletionCard({
  batch,
  setView,
  persistBatch,
  setBatch,
}: {
  batch: Batch;
  setView: (view: View) => void;
  persistBatch: (value: Batch) => void;
  setBatch: (value: Batch | null) => void;
}) {
  const [output, setOutput] = useState(batch.output !== undefined && batch.output !== null ? String(batch.output) : "0");
  const [unit, setUnit] = useState(batch.jobSnapshot.unit || "Liter");
  const [storageLocation, setStorageLocation] = useState(batch.storage_location || "");
  const [fillingDate, setFillingDate] = useState(batch.filling_date || new Date().toISOString().slice(0, 10));
  const [specialNotes, setSpecialNotes] = useState(batch.special_notes || "");
  const [expiredDate, setExpiredDate] = useState(batch.expired_date || "");
  const [errors, setErrors] = useState<{
    output?: string;
    storageLocation?: string;
    fillingDate?: string;
    expiredDate?: string;
  }>({});

  const handlePrint = async () => {
    const newErrors: typeof errors = {};
    if (!output || output.trim() === "" || Number(output) === 0) {
      newErrors.output = "Estimasi Hasil Produksi wajib diisi dan tidak boleh 0!";
    }
    if (!storageLocation || storageLocation.trim() === "") {
      newErrors.storageLocation = "Lokasi Penyimpanan wajib diisi!";
    }
    if (!fillingDate || fillingDate.trim() === "") {
      newErrors.fillingDate = "Estimasi Tanggal Filling wajib diisi!";
    }
    if (!expiredDate || expiredDate.trim() === "") {
      newErrors.expiredDate = "EXP Date wajib diisi!";
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }

    // Persist updated values before printing
    const updatedBatch: Batch = {
      ...batch,
      output: Number(output) || 0,
      storage_location: storageLocation,
      filling_date: fillingDate,
      expired_date: expiredDate,
      special_notes: specialNotes,
    };
    setBatch(updatedBatch);
    persistBatch(updatedBatch);

    const startedIso = (batch.startedAt && !isNaN(new Date(batch.startedAt).getTime()))
      ? new Date(batch.startedAt).toISOString()
      : new Date().toISOString();
    const seq = await getProductionSeqOfToday(
      batch.id,
      batch.jobSnapshot.id,
      startedIso
    ).catch(() => 1);
    const code = (batch.jobSnapshot.product_code || batch.jobSnapshot.product || "PRODUK").trim();
    const originalTitle = document.title || "AUTOMOVA";
    const titleEl = document.querySelector('title');
    const d = new Date(batch.startedAt);
    const ddmmyy = `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getFullYear()).slice(2)}`;
    
    const newTitle = batch.batch_no || `${ddmmyy} ${code}_${seq}`;
    document.title = newTitle;
    if (titleEl) {
      titleEl.textContent = newTitle;
    }
    
    setTimeout(() => {
      window.print();
      
      // Delay title restoration to ensure Windows print spooler captured it
      setTimeout(() => {
        document.title = originalTitle;
        if (titleEl) {
          titleEl.textContent = originalTitle;
        }
      }, 5000);
    }, 250);
  };

  return (
    <div className="completion-wrap">
      <div className="completion-card">
        <span className="completion-icon">
          <i className="bi bi-check-lg" />
        </span>
        <p className="section-kicker">BATCH COMPLETED</p>
        <h1>Produksi berhasil diselesaikan</h1>
        <p>Silakan lengkapi data berikut untuk mencetak label Batch.</p>
        <div className="completion-summary">
          <div>
            <small>Batch No</small>
            <strong>{batch.batch_no || batch.id}</strong>
          </div>
          <div>
            <small>Job</small>
            <strong>
              {batch.jobSnapshot.name} · v{batch.jobSnapshot.version}
            </strong>
          </div>

          <div>
            <small>Total Durasi</small>
            <strong>
              {fmtClock(
                Math.floor(
                  ((batch.completedAt ?? batch.startedAt) - batch.startedAt) /
                    1000,
                ),
              )}
            </strong>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px', textAlign: 'left' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <small>Estimasi Hasil Produksi</small>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="number" style={{ flex: 1, padding: '8px', borderRadius: '4px', border: errors.output ? '1.5px solid #dc3545' : '1px solid var(--border)' }} value={output} onChange={e => setOutput(e.target.value)} />
              <select style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }} value={unit} onChange={e => setUnit(e.target.value)}>
                <option value="Liter">Liter</option>
                <option value="Kg">Kg</option>
                <option value="Pcs">Pcs</option>
              </select>
            </div>
            {errors.output && (
              <span style={{ color: '#dc3545', fontSize: '11px', fontWeight: '600', marginTop: '2px' }}>
                {errors.output}
              </span>
            )}
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <small>Lokasi Penyimpanan</small>
            <input type="text" style={{ padding: '8px', borderRadius: '4px', border: errors.storageLocation ? '1.5px solid #dc3545' : '1px solid var(--border)' }} value={storageLocation} onChange={e => setStorageLocation(e.target.value)} />
            {errors.storageLocation && (
              <span style={{ color: '#dc3545', fontSize: '11px', fontWeight: '600', marginTop: '2px' }}>
                {errors.storageLocation}
              </span>
            )}
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <small>Estimasi Tanggal Filling</small>
            <input type="date" style={{ padding: '8px', borderRadius: '4px', border: errors.fillingDate ? '1.5px solid #dc3545' : '1px solid var(--border)' }} value={fillingDate} onChange={e => setFillingDate(e.target.value)} />
            {errors.fillingDate && (
              <span style={{ color: '#dc3545', fontSize: '11px', fontWeight: '600', marginTop: '2px' }}>
                {errors.fillingDate}
              </span>
            )}
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <small>EXP Date</small>
            <input type="text" style={{ padding: '8px', borderRadius: '4px', border: errors.expiredDate ? '1.5px solid #dc3545' : '1px solid var(--border)' }} value={expiredDate} onChange={e => setExpiredDate(e.target.value)} />
            {errors.expiredDate && (
              <span style={{ color: '#dc3545', fontSize: '11px', fontWeight: '600', marginTop: '2px' }}>
                {errors.expiredDate}
              </span>
            )}
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <small>Catatan Khusus</small>
            <input type="text" style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }} value={specialNotes} onChange={e => setSpecialNotes(e.target.value)} />
          </label>
        </div>

        <div className="completion-actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '24px' }}>
          <PrintableLabel 
            batchNo={batch.batch_no || batch.id}
            productCode={batch.jobSnapshot.product_code || "-"}
            productName={batch.jobSnapshot.product}
            packagingCode={batch.packaging_code || "-"}
            fillingDate={fillingDate || "-"}
            expiredDate={expiredDate || "-"}
            storageLocation={storageLocation || "-"}
            output={output || 0}
            unit={batch.jobSnapshot.unit}
            specialNotes={specialNotes || ""}
          />
          <button
            className="btn btn-primary btn-lg"
            onClick={handlePrint}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: '1.2', padding: '12px' }}
          >
            <div><i className="bi bi-printer" /> PRINT LABEL</div>
            <small style={{ fontSize: '11px', fontWeight: 'normal', opacity: 0.8, marginTop: '4px' }}>(Instruksi: Tempelkan pada drum yang telah selesai produksi)</small>
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-outline-primary"
              style={{ flex: 1 }}
              onClick={() => setView("history")}
            >
              <i className="bi bi-clock-history" /> Lihat History
            </button>
            <button className="btn btn-outline-secondary" style={{ flex: 1 }} onClick={() => setView("home")}>
              <i className="bi bi-house-door" /> Kembali
            </button>
          </div>
        </div>
      </div>
      <PrintableTicket batch={{
        batch_no: batch.batch_no || batch.id,
        job_name: batch.jobSnapshot.name,
        operator: batch.operator,
        line: batch.jobSnapshot.line,
        start_time: new Date(batch.startedAt).toISOString(),
        end_time: batch.completedAt ? new Date(batch.completedAt).toISOString() : undefined,
        output_qty: output,
        unit: batch.jobSnapshot.unit,
        status: batch.status,
        product_code: batch.jobSnapshot.product_code,
        storage_location: storageLocation,
        filling_date: fillingDate,
        special_notes: specialNotes,
        expired_date: expiredDate,
      }} />

    </div>
  );
}

function OperatorHistory({ history, jobs }: { history: HistoryRow[]; jobs: Job[] }) {
  const [printBatch, setPrintBatch] = useState<any>(null);

  return (
    <div className="operator-container">
      <div className="simple-page-head">
        <div>
          <p className="section-kicker">RIWAYAT PRODUKSI</p>
          <h1>Batch terakhir Anda</h1>
          <p>Telusuri output dan status produksi yang pernah dikerjakan.</p>
        </div>
      </div>
      <div className="mobile-history-list">
        {history.map((item) => (
          <article key={item.id}>
            <div>
              <strong>{item.job}</strong>
              <small>{item.id}</small>
            </div>
            <StatusBadge status={item.status} />
            <div className="history-meta">
              <span>
                <small>Tanggal</small>
                {item.date}
              </span>
              <span>
                <small>Output</small>
                {item.output}
              </span>
              <span>
                <small>Durasi</small>
                {item.duration}
              </span>
            </div>
            {item.rawBatch && (
              <button 
                className="btn btn-sm btn-outline-primary" 
                style={{ width: '100%', marginTop: '12px' }}
                onClick={async () => {
                  setPrintBatch(item.rawBatch);
                  const seq = await getProductionSeqOfToday(
                    item.rawBatch.id,
                    item.rawBatch.job_id,
                    item.rawBatch.started_at
                  );
                  const job = jobs.find(j => j.id === item.rawBatch.job_id);
                  const code = (job?.product_code || job?.product || "PRODUK").trim();
                  const originalTitle = document.title || "AUTOMOVA";
                  const titleEl = document.querySelector('title');
                  const d = new Date(item.rawBatch.started_at);
                  const ddmmyy = `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getFullYear()).slice(2)}`;
                  
                  const newTitle = item.rawBatch.batch_no || `${ddmmyy} ${code}_${seq}`;
                  document.title = newTitle;
                  if (titleEl) {
                    titleEl.textContent = newTitle;
                  }
                  
                  setTimeout(() => {
                    window.print();
                    
                    // Delay title restoration to ensure Windows print spooler captured it
                    setTimeout(() => {
                      document.title = originalTitle;
                      if (titleEl) {
                        titleEl.textContent = originalTitle;
                      }
                    }, 5000);
                  }, 250);
                }}
              >
                <i className="bi bi-printer" /> Cetak Label
              </button>
            )}
          </article>
        ))}
      </div>
      {printBatch && (
        <PrintableTicket batch={{
          batch_no: printBatch.batch_no || printBatch.id,
          job_name: printBatch.job_name,
          operator: printBatch.operator_name,
          line: "Line N/A", // Line isn't fully in batches table directly without job lookup, but this is fine for history reprint
          start_time: new Date(printBatch.started_at).toISOString(),
          end_time: printBatch.completed_at ? new Date(printBatch.completed_at).toISOString() : undefined,
          output_qty: printBatch.output || 0,
          unit: printBatch.unit,
          status: printBatch.status,
          product_code: jobs.find(j => j.id === printBatch.job_id)?.product_code || "",
          storage_location: printBatch.storage_location || "",
          filling_date: printBatch.filling_date || "",
          special_notes: printBatch.special_notes || "",
          expired_date: printBatch.expired_date || "",
        }} />
      )}
    </div>
  );
}

function AccountCard({
  authUser,
  operatorName,
  logout,
  setToast,
}: {
  authUser: AuthUser | null;
  operatorName: string;
  logout: () => void;
  setToast?: (msg: string) => void;
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinTarget, setPinTarget] = useState<"supervisor" | "admin">("supervisor");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState("");
  const [showSpvPin, setShowSpvPin] = useState(false);
  const [showAdminPin, setShowAdminPin] = useState(false);
  const [pins, setPins] = useState({ supervisorPin: "2468", adminPin: "1357" });

  const initials = operatorName
    ? operatorName
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "OP";

  const isSupervisor = authUser?.role_id === "role-supervisor" || 
    authUser?.role_id === "role-admin" || 
    !!(authUser?.role_name && (
      authUser.role_name.toLowerCase().includes("supervisor") ||
      authUser.role_name.toLowerCase().includes("spv") ||
      authUser.role_name.toLowerCase().includes("admin")
    ));

  useEffect(() => {
    if (isSupervisor) {
      apiFetch<{ supervisorPin: string; adminPin: string }>("/auth/pins")
        .then((res) => {
          if (res) {
            setPins({
              supervisorPin: res.supervisorPin || "2468",
              adminPin: res.adminPin || "1357",
            });
          }
        })
        .catch((err) => console.error("Gagal memuat PIN:", err));
    }
  }, [isSupervisor, isPinModalOpen]);

  const copyToClipboard = (text: string, label: string) => {
    try {
      void navigator.clipboard.writeText(text);
      setCopiedField(label);
      if (setToast) setToast(`${label} '${text}' berhasil disalin!`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      if (setToast) setToast(`${label}: ${text}`);
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError("");
    setPinSuccess("");

    if (!currentPin || !newPin || !confirmPin) {
      setPinError("Semua field wajib diisi.");
      return;
    }

    if (newPin !== confirmPin) {
      setPinError("PIN baru dan konfirmasi PIN tidak cocok.");
      return;
    }

    if (newPin.length < 4) {
      setPinError("PIN baru minimal harus 4 digit.");
      return;
    }

    const endpoint = pinTarget === "admin" ? "/admin/change-pin" : "/supervisor/change-pin";
    const label = pinTarget === "admin" ? "Administrator" : "Supervisor";

    try {
      await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ currentPin, newPin }),
      });
      setPinSuccess(`PIN ${label} berhasil diubah!`);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      if (setToast) setToast(`PIN ${label} berhasil diubah!`);
      setTimeout(() => {
        setIsPinModalOpen(false);
        setPinSuccess("");
      }, 1500);
    } catch (err) {
      setPinError(err instanceof Error ? err.message : `Gagal mengubah PIN ${label}.`);
    }
  };

  return (
    <div className="account-wrap" style={{ maxWidth: 740, margin: "0 auto", padding: "1rem" }}>
      <div className="panel" style={{ borderRadius: 16, padding: "2rem", background: "var(--surface-color, #ffffff)", boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }}>
        {/* Header Profile Info */}
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginBottom: "2rem", borderBottom: "1px solid var(--border-color, #e5e7eb)", paddingBottom: "1.5rem" }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
            color: "#ffffff",
            fontSize: "24px",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)"
          }}>
            {initials}
          </div>
          <div>
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: "#6b7280", textTransform: "uppercase" }}>
              PROFILE PENGGUNA TERDAFTAR
            </span>
            <h1 style={{ fontSize: "22px", fontWeight: 800, margin: "0.25rem 0", color: "#111827" }}>
              {operatorName || authUser?.name || "Pengguna System"}
            </h1>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
              <span className="badge bg-primary" style={{ padding: "0.4rem 0.75rem", borderRadius: 20, fontSize: "11px" }}>
                <i className="bi bi-person-badge" /> {authUser?.role_name || "Operator Produksi"}
              </span>
              <span className="badge bg-secondary" style={{ padding: "0.4rem 0.75rem", borderRadius: 20, fontSize: "11px" }}>
                <i className="bi bi-clock-history" /> {authUser?.shift || "Shift 2"}
              </span>
              <span className="badge bg-success" style={{ padding: "0.4rem 0.75rem", borderRadius: 20, fontSize: "11px" }}>
                <i className="bi bi-wifi" /> Online (LAN Connected)
              </span>
            </div>
          </div>
        </div>

        {/* SPECIAL SUPERVISOR PIN CARD */}
        {isSupervisor && (
          <div style={{
            background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
            color: "#ffffff",
            borderRadius: 12,
            padding: "1.25rem 1.5rem",
            marginBottom: "1.75rem",
            boxShadow: "0 6px 20px rgba(49, 46, 129, 0.25)",
            position: "relative",
            overflow: "hidden"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#c7d2fe", fontSize: "12px", fontWeight: 600 }}>
                  <i className="bi bi-shield-lock-fill" style={{ color: "#818cf8" }} /> PIN OTORISASI SUPERVISOR
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.4rem" }}>
                  <span style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "0.15em", fontFamily: "monospace", color: "#fbbf24", minWidth: "120px" }}>
                    {showSpvPin ? pins.supervisorPin : "••••"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSpvPin(!showSpvPin)}
                    style={{
                      background: "rgba(255,255,255,0.15)",
                      border: "none",
                      color: "#fbbf24",
                      borderRadius: 8,
                      padding: "0.2rem 0.5rem",
                      cursor: "pointer",
                      fontSize: "13px",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      transition: "all 0.2s"
                    }}
                    title={showSpvPin ? "Sembunyikan PIN" : "Tampilkan PIN"}
                  >
                    <i className={`bi ${showSpvPin ? "bi-eye-slash" : "bi-eye"}`} /> {showSpvPin ? "Sembunyikan" : "Lihat"}
                  </button>
                  <small style={{ color: "#a5b4fc", marginLeft: "1rem" }}>Dipakai untuk Resume & Cancel Batch</small>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-warning"
                onClick={() => { setPinTarget("supervisor"); setIsPinModalOpen(true); }}
                style={{
                  fontWeight: 700,
                  borderRadius: 8,
                  padding: "0.6rem 1.25rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  boxShadow: "0 2px 8px rgba(251, 191, 36, 0.4)",
                  border: "none"
                }}
              >
                <i className="bi bi-key-fill" /> Ubah PIN Supervisor
              </button>
            </div>
            <p style={{ margin: "0.75rem 0 0 0", fontSize: "11px", color: "#c7d2fe", borderTop: "1px solid rgba(199, 210, 254, 0.15)", paddingTop: "0.6rem" }}>
              <i className="bi bi-info-circle" /> Gunakan PIN ini jika Operator membutuhkan otorisasi supervisor untuk melompati kendala atau membatalkan batch aktif.
            </p>
          </div>
        )}

        {/* SPECIAL ADMINISTRATOR PIN CARD */}
        {(authUser?.role_id === "role-admin" || !!(authUser?.role_name && authUser.role_name.toLowerCase().includes("admin"))) && (
          <div style={{
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            color: "#ffffff",
            borderRadius: 12,
            padding: "1.25rem 1.5rem",
            marginBottom: "1.75rem",
            boxShadow: "0 6px 20px rgba(15, 23, 42, 0.25)",
            position: "relative",
            overflow: "hidden"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#cbd5e1", fontSize: "12px", fontWeight: 600 }}>
                  <i className="bi bi-shield-lock-fill" style={{ color: "#38bdf8" }} /> PIN OTORISASI ADMINISTRATOR
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.4rem" }}>
                  <span style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "0.15em", fontFamily: "monospace", color: "#38bdf8", minWidth: "120px" }}>
                    {showAdminPin ? pins.adminPin : "••••"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAdminPin(!showAdminPin)}
                    style={{
                      background: "rgba(255,255,255,0.15)",
                      border: "none",
                      color: "#38bdf8",
                      borderRadius: 8,
                      padding: "0.2rem 0.5rem",
                      cursor: "pointer",
                      fontSize: "13px",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      transition: "all 0.2s"
                    }}
                    title={showAdminPin ? "Sembunyikan PIN" : "Tampilkan PIN"}
                  >
                    <i className={`bi ${showAdminPin ? "bi-eye-slash" : "bi-eye"}`} /> {showAdminPin ? "Sembunyikan" : "Lihat"}
                  </button>
                  <small style={{ color: "#94a3b8", marginLeft: "1rem" }}>Dipakai untuk Override & Otorisasi Sistem</small>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-info"
                onClick={() => { setPinTarget("admin"); setIsPinModalOpen(true); }}
                style={{
                  fontWeight: 700,
                  borderRadius: 8,
                  padding: "0.6rem 1.25rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  boxShadow: "0 2px 8px rgba(56, 189, 248, 0.4)",
                  border: "none",
                  backgroundColor: "#38bdf8",
                  color: "#0f172a"
                }}
              >
                <i className="bi bi-key-fill" /> Ubah PIN Administrator
              </button>
            </div>
            <p style={{ margin: "0.75rem 0 0 0", fontSize: "11px", color: "#cbd5e1", borderTop: "1px solid rgba(203, 213, 225, 0.15)", paddingTop: "0.6rem" }}>
              <i className="bi bi-info-circle" /> Gunakan PIN ini sebagai otoritas tertinggi administrator untuk melompati kendala proses produksi atau otorisasi manual.
            </p>
          </div>
        )}

        {/* Personal & Detail Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem", marginBottom: "2rem" }}>
          <div style={{ background: "var(--surface-color-2, #f9fafb)", border: "1px solid var(--border-color, #e5e7eb)", borderRadius: 10, padding: "1rem" }}>
            <span style={{ fontSize: "10px", color: "#6b7280", fontWeight: 600, display: "block" }}>USERNAME LOGIN</span>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.25rem" }}>
              <strong style={{ fontSize: "14px", color: "#111827" }}>{authUser?.username || "user"}</strong>
              <button
                type="button"
                className="btn btn-sm btn-light"
                onClick={() => copyToClipboard(authUser?.username || "user", "Username")}
                title="Salin Username"
              >
                <i className={`bi ${copiedField === "Username" ? "bi-check" : "bi-copy"}`} />
              </button>
            </div>
          </div>

          <div style={{ background: "var(--surface-color-2, #f9fafb)", border: "1px solid var(--border-color, #e5e7eb)", borderRadius: 10, padding: "1rem" }}>
            <span style={{ fontSize: "10px", color: "#6b7280", fontWeight: 600, display: "block" }}>NO. KARYAWAN (EMP ID)</span>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.25rem" }}>
              <strong style={{ fontSize: "14px", color: "#111827" }}>{authUser?.employee_no || "EMP-001"}</strong>
              <button
                type="button"
                className="btn btn-sm btn-light"
                onClick={() => copyToClipboard(authUser?.employee_no || "EMP-001", "No. Karyawan")}
                title="Salin No. Karyawan"
              >
                <i className={`bi ${copiedField === "No. Karyawan" ? "bi-check" : "bi-copy"}`} />
              </button>
            </div>
          </div>

          <div style={{ background: "var(--surface-color-2, #f9fafb)", border: "1px solid var(--border-color, #e5e7eb)", borderRadius: 10, padding: "1rem" }}>
            <span style={{ fontSize: "10px", color: "#6b7280", fontWeight: 600, display: "block" }}>JABATAN / ROLE</span>
            <strong style={{ fontSize: "14px", color: "#111827", display: "block", marginTop: "0.25rem" }}>
              {authUser?.role_name || "Operator Produksi"}
            </strong>
          </div>

          <div style={{ background: "var(--surface-color-2, #f9fafb)", border: "1px solid var(--border-color, #e5e7eb)", borderRadius: 10, padding: "1rem" }}>
            <span style={{ fontSize: "10px", color: "#6b7280", fontWeight: 600, display: "block" }}>SHIFT OPERASIONAL</span>
            <strong style={{ fontSize: "14px", color: "#111827", display: "block", marginTop: "0.25rem" }}>
              {authUser?.shift || "Shift 2 (Aktif)"}
            </strong>
          </div>
        </div>

        {/* Logout Action */}
        <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--border-color, #e5e7eb)", paddingTop: "1.5rem" }}>
          <button className="btn btn-outline-danger btn-lg" onClick={logout} style={{ display: "flex", alignItems: "center", gap: "0.5rem", borderRadius: 8 }}>
            <i className="bi bi-box-arrow-right" /> Keluar dari Sistem
          </button>
        </div>
      </div>

      {isPinModalOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "1rem"
        }} onClick={() => setIsPinModalOpen(false)}>
          <div style={{
            background: "var(--surface-color, #ffffff)",
            borderRadius: 16,
            width: "100%",
            maxWidth: "420px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            overflow: "hidden"
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              background: pinTarget === "admin" ? "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" : "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
              padding: "1.25rem 1.5rem",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}>
              <h3 style={{ fontSize: "18px", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <i className="bi bi-key-fill" style={{ color: pinTarget === "admin" ? "#38bdf8" : "#fbbf24" }} /> Ubah PIN {pinTarget === "admin" ? "Administrator" : "Supervisor"}
              </h3>
              <button 
                type="button" 
                onClick={() => setIsPinModalOpen(false)}
                style={{ background: "none", border: "none", color: "#c7d2fe", fontSize: "20px", cursor: "pointer" }}
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleChangePin} style={{ padding: "1.5rem" }}>
              {pinError && (
                <div className="alert alert-danger" style={{ fontSize: "13px", padding: "8px 12px", borderRadius: 8, marginBottom: "1rem" }}>
                  <i className="bi bi-exclamation-circle-fill" /> {pinError}
                </div>
              )}
              {pinSuccess && (
                <div className="alert alert-success" style={{ fontSize: "13px", padding: "8px 12px", borderRadius: 8, marginBottom: "1rem" }}>
                  <i className="bi bi-check-circle-fill" /> {pinSuccess}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#4b5563", marginBottom: "4px", display: "block" }}>
                    PIN {pinTarget === "admin" ? "Administrator" : "Supervisor"} Saat Ini
                  </label>
                  <input
                    type="password"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    maxLength={8}
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="Masukkan PIN saat ini"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "1.5px solid var(--border-color, #e5e7eb)",
                      fontSize: "14px",
                      fontWeight: 600,
                      letterSpacing: "0.1em"
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#4b5563", marginBottom: "4px", display: "block" }}>
                    PIN Baru (Angka)
                  </label>
                  <input
                    type="password"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    maxLength={8}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="Masukkan PIN baru"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "1.5px solid var(--border-color, #e5e7eb)",
                      fontSize: "14px",
                      fontWeight: 600,
                      letterSpacing: "0.1em"
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#4b5563", marginBottom: "4px", display: "block" }}>
                    Konfirmasi PIN Baru
                  </label>
                  <input
                    type="password"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    maxLength={8}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="Ketik ulang PIN baru"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "1.5px solid var(--border-color, #e5e7eb)",
                      fontSize: "14px",
                      fontWeight: 600,
                      letterSpacing: "0.1em"
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button 
                  type="button" 
                  className="btn btn-light" 
                  onClick={() => setIsPinModalOpen(false)}
                  style={{ borderRadius: 8, padding: "8px 16px", fontWeight: 600 }}
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ borderRadius: 8, padding: "8px 20px", fontWeight: 600 }}
                >
                  Simpan PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminContent(props: {
  role: "admin" | "supervisor";
  view: View;
  setView: (view: View) => void;
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  batch: Batch | null;
  history: HistoryRow[];
  query: string;
  setQuery: (value: string) => void;
  exportCsv: () => void;
  setToast: (value: string) => void;
  authUser: AuthUser | null;
  operatorName: string;
  logout: () => void;
  availableSounds?: { id: string; name: string; filename: string }[];
}) {
  const { view, setView, jobs, setJobs, setToast, availableSounds = [] } = props;
  if (!hasViewPermission(view, props.authUser, props.role)) {
    return (
      <div className="card" style={{ padding: "3rem", textAlign: "center", maxWidth: 500, margin: "4rem auto", borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
        <i className="bi bi-shield-slash" style={{ fontSize: "3rem", color: "#ef4444", display: "block", marginBottom: "1rem" }} />
        <h3 style={{ marginBottom: "0.5rem", color: "#111827" }}>Akses Ditolak</h3>
        <p style={{ color: "#6b7280", fontSize: "14px" }}>Anda tidak memiliki hak akses untuk membuka menu ini. Silakan hubungi Administrator untuk memperbarui hak akses Anda.</p>
        <button className="btn btn-primary" onClick={() => setView("home")} style={{ marginTop: "1rem", borderRadius: 8 }}>
          Kembali ke Dashboard
        </button>
      </div>
    );
  }
  if (view === "account")
    return (
      <AccountCard
        authUser={props.authUser}
        operatorName={props.operatorName}
        logout={props.logout}
        setToast={setToast}
      />
    );
  if (view === "jobs")
    return <JobManagement authUser={props.authUser} jobs={jobs} setJobs={setJobs} setToast={setToast} availableSounds={availableSounds} />;
  if (view === "materials") return <MaterialMaster authUser={props.authUser} notify={setToast} />;
  if (view === "master-packaging") return <PackagingMaster authUser={props.authUser} notify={setToast} />;
  if (view === "master-areas") return <GenericMasterList title="Area Produksi" endpoint="/master_areas" notify={setToast} />;
  if (view === "master-lines") return <GenericMasterList title="Line Operasional" endpoint="/master_lines" hasAreaId notify={setToast} />;
  if (view === "master-shifts") return <GenericMasterList title="Shift Kerja" endpoint="/master_shifts" notify={setToast} />;
  if (view === "master-units") return <GenericMasterList title="Satuan Ukur" endpoint="/master_units" notify={setToast} />;
  if (view === "material-ledger") return <MaterialLedger notify={setToast} />;
  if (view === "packaging-ledger") return <PackagingLedger notify={setToast} />;
  if (view === "users") return <UserMaster notify={setToast} />;
  if (view === "access") return <AccessMaster notify={setToast} />;
  if (view === "performance") return <OperatorPerformance notify={setToast} />;
  if (view === "history")
    return <DatabaseBatchHistory notify={setToast} role={props.role} authUser={props.authUser} />;
  if (view === "reports") return <ReportManager notify={setToast} authUser={props.authUser} />;
  if (view === "settings") return <SystemSettingsMaster notify={setToast} />;
  return (
    <DynamicDashboard role={props.role} notify={setToast} onNavigate={() => setView("history")} />
  );
}

// Legacy visual retained as a fallback reference for offline prototyping.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Dashboard({
  jobs,
  batch,
  history,
  setView,
}: {
  jobs: Job[];
  batch: Batch | null;
  history: HistoryRow[];
  setView: (view: View) => void;
}) {
  const metrics = [
    {
      label: "Produksi Hari Ini",
      value: "3.250",
      suffix: "Liter",
      icon: "bi-graph-up-arrow",
      tone: "blue",
      note: "+12% dari kemarin",
    },
    {
      label: "Job Aktif",
      value: String(jobs.filter((j) => j.status === "Published").length + 5),
      suffix: "",
      icon: "bi-play-circle",
      tone: "green",
      note: "2 akan selesai hari ini",
    },
    {
      label: "Batch Selesai",
      value: String(
        history.filter((h) => h.status === "Completed").length + 11,
      ),
      suffix: "",
      icon: "bi-check2-circle",
      tone: "purple",
      note: "7 dari shift berjalan",
    },
    {
      label: "Job Paused",
      value: batch?.status === "Paused" ? "3" : "2",
      suffix: "",
      icon: "bi-pause-circle",
      tone: "orange",
      note: "Perlu perhatian",
    },
  ];
  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <p className="section-kicker">RINGKASAN OPERASIONAL</p>
          <h1>Dashboard</h1>
          <p>
            Monitor produksi dan kendala pada jaringan lokal secara real-time.
          </p>
        </div>
        <div className="header-actions">
          <button className="btn btn-light">
            <i className="bi bi-calendar3" /> 22 Jul 2026
          </button>
          <button className="btn btn-primary">
            <i className="bi bi-arrow-clockwise" /> Refresh
          </button>
        </div>
      </div>
      <div className="metric-grid">
        {metrics.map((m) => (
          <article className="metric-card" key={m.label}>
            <span className={`metric-icon ${m.tone}`}>
              <i className={`bi ${m.icon}`} />
            </span>
            <div>
              <small>{m.label}</small>
              <strong>
                {m.value} <em>{m.suffix}</em>
              </strong>
              <span>{m.note}</span>
            </div>
          </article>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel chart-card">
          <div className="panel-head">
            <div>
              <h2>Produksi 7 Hari Terakhir</h2>
              <p>Total output produk cair</p>
            </div>
            <button>
              Liter <i className="bi bi-chevron-down" />
            </button>
          </div>
          <div className="bar-chart">
            {[58, 72, 68, 83, 64, 77, 96].map((height, i) => (
              <div key={i}>
                <span
                  style={{ height: `${height}%` }}
                  className={i === 6 ? "today" : ""}
                >
                  {i === 6 && <em>3.250 L</em>}
                </span>
                <small>
                  {
                    [
                      "16 Jul",
                      "17 Jul",
                      "18 Jul",
                      "19 Jul",
                      "20 Jul",
                      "21 Jul",
                      "22 Jul",
                    ][i]
                  }
                </small>
              </div>
            ))}
          </div>
        </section>
        <section className="panel recent-card">
          <div className="panel-head">
            <div>
              <h2>Batch Produksi Terbaru</h2>
              <p>Pembaruan transaksi terkini</p>
            </div>
            <button onClick={() => setView("history")}>Lihat semua</button>
          </div>
          <div className="recent-list">
            {history.slice(0, 4).map((item) => (
              <div key={item.id}>
                <span className={`recent-status ${item.status.toLowerCase()}`}>
                  <i
                    className={`bi ${item.status === "Completed" ? "bi-check-lg" : item.status === "Paused" ? "bi-pause-fill" : "bi-x-lg"}`}
                  />
                </span>
                <div>
                  <strong>{item.job}</strong>
                  <small>
                    {item.id} · {item.operator}
                  </small>
                </div>
                <StatusBadge status={item.status} />
              </div>
            ))}
          </div>
        </section>
        <section className="panel issue-card">
          <div className="panel-head">
            <div>
              <h2>Kendala Produksi</h2>
              <p>Paused dan warning terbaru</p>
            </div>
            <button>Lihat semua</button>
          </div>
          <div className="issue-list">
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "12px 0" }}>
              Belum ada aktivitas terkini.
            </div>
          </div>
        </section>
        <section className="panel material-card">
          <div className="panel-head">
            <div>
              <h2>Top Bahan Digunakan</h2>
              <p>Akumulasi 7 hari terakhir</p>
            </div>
            <button>7 Hari</button>
          </div>
          {[
            ["Air", "5.250 L", 94],
            ["Emal 270N", "3.980 Kg", 74],
            ["Garam", "2.150 Kg", 48],
            ["Caustic Soda", "1.440 Kg", 32],
          ].map((m) => (
            <div className="material-bar" key={m[0]}>
              <div>
                <strong>{m[0]}</strong>
                <span>{m[1]}</span>
              </div>
              <i>
                <em style={{ width: `${m[2]}%` }} />
              </i>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function JobManagement({
  authUser,
  jobs,
  setJobs,
  setToast,
  availableSounds = [],
}: {
  authUser: any;
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  setToast: (value: string) => void;
  availableSounds?: { id: string; name: string; filename: string }[];
}) {
  const isSuperUser = authUser?.username?.toLowerCase() === "suganda" || authUser?.username?.toLowerCase() === "admin";
  // ─── State ───────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState(-1);
  const [materialMaster, setMaterialMaster] = useState<
    Array<{
      id: string;
      code: string;
      name: string;
      default_qty: number;
      unit: string;
      unit_price: number;
      currency: string;
      status: string;
    }>
  >([]);
  const [packagingMaster, setPackagingMaster] = useState<
    Array<{
      id: string;
      code: string;
      name: string;
      default_qty: number;
      unit: string;
      unit_price: number;
      currency: string;
      status: string;
      initial_stock?: number;
    }>
  >([]);
  const [masterShifts, setMasterShifts] = useState<{ id: string; name: string }[]>([]);
  const [masterAreas, setMasterAreas] = useState<{ id: string; name: string }[]>([]);
  const [masterLines, setMasterLines] = useState<{ id: string; name: string; area_id: string }[]>([]);
  const [masterUnits, setMasterUnits] = useState<{ id: string; name: string }[]>([]);

  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [selectedPackaging, setSelectedPackaging] = useState("");
  const [jobSearch, setJobSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draftJob, setDraftJob] = useState<Job | null>(null);
  
  const filteredJobs = useMemo(
    () =>
      jobs.filter((item) =>
        item.name.toLowerCase().includes(jobSearch.toLowerCase()) ||
        item.product.toLowerCase().includes(jobSearch.toLowerCase()) ||
        item.status.toLowerCase().includes(jobSearch.toLowerCase()),
      ),
    [jobs, jobSearch],
  );
  
  const jobIndexFromId = (id: string) => jobs.findIndex((j) => j.id === id);
  
  useEffect(() => {
    apiFetch<{
      data: Array<{
        id: string;
        code: string;
        name: string;
        default_qty: number;
        unit: string;
        unit_price: number;
        currency: string;
        status: string;
      }>;
    }>("/materials")
      .then((response) =>
        setMaterialMaster(
          response.data.filter((material) => material.status === "Active"),
        ),
      )
      .catch((error) =>
        setToast(
          error instanceof Error ? error.message : "Material gagal dimuat",
        ),
      );

    apiFetch<{
      data: Array<{
        id: string;
        code: string;
        name: string;
        default_qty: number;
        unit: string;
        unit_price: number;
        currency: string;
        status: string;
        initial_stock?: number;
      }>;
    }>("/master_packaging")
      .then((response) =>
        setPackagingMaster(
          response.data.filter((pkg) => pkg.status === "Active"),
        ),
      )
      .catch((error) =>
        setToast(
          error instanceof Error ? error.message : "Kemasan gagal dimuat",
        ),
      );

    apiFetch<{ data: { id: string; name: string }[] }>("/master_shifts")
      .then((res) => setMasterShifts(res.data))
      .catch(console.error);

    apiFetch<{ data: { id: string; name: string }[] }>("/master_areas")
      .then((res) => setMasterAreas(res.data))
      .catch(console.error);

    apiFetch<{ data: { id: string; name: string; area_id: string }[] }>("/master_lines")
      .then((res) => setMasterLines(res.data))
      .catch(console.error);

    apiFetch<{ data: { id: string; name: string }[] }>("/master_units")
      .then((res) => setMasterUnits(res.data))
      .catch(console.error);
  }, [setToast]);
  
  const updateJob = (patch: Partial<Job>) =>
    setJobs((current) =>
      current.map((item, index) =>
        index === selected ? { ...item, ...patch } : item,
      ),
    );
    
  const saveDraft = async () => {
    if (!job) return;
    try {
      await apiFetch(`/jobs/${job.id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...job,
          popup_enabled: job.popupEnabled,
          popup_title: job.popupTitle,
          popup_message: job.popupMessage,
          allow_overdrive: job.allowOverdrive !== false,
        }),
      });
      setToast("Draft Job, material, dan step tersimpan ke database.");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Gagal menyimpan draft");
      throw err;
    }
  };

  const publish = async () => {
    if (!job) return;
    if ((job.steps || []).length === 0) {
      setToast("Gagal mempublish: Instruksi kerja harus memiliki minimal 1 langkah kerja.");
      return;
    }
    try {
      await saveDraft();
      await apiFetch(`/jobs/${job.id}/publish`, { method: "POST" });
      updateJob({
        status: "Published",
        version: job.version + 1,
        updated: fmtDate(Date.now()),
      });
      setToast(`Version ${job.version + 1} berhasil dipublish.`);
      closeEditModal();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Gagal mempublish job");
    }
  };
  
  const addStep = () => {
    if (!job) return;
    const next = (job.steps || []).length + 1;
    updateJob({
      steps: [
        ...(job.steps || []),
        {
          id: next,
          title: `Step Baru ${next}`,
          instruction: "Tuliskan instruksi kerja pada tahap ini.",
          warning: "Tambahkan peringatan keselamatan jika diperlukan.",
          duration: 120,
          action: "Selesai",
          allow_overdrive: true,
          loop_warning: true,
        },
      ],
    });
    setToast("Step baru ditambahkan ke draft.");
  };
  
  const addMaterial = () => {
    if (!job) return;
    const material = materialMaster.find(
      (item) => item.id === selectedMaterial,
    );
    if (!material) {
      setToast("Tambahkan Material Master aktif terlebih dahulu.");
      return;
    }
    if (job.materials.some((item) => item.material_id === material.id)) {
      setToast("Material tersebut sudah ada di Job.");
      return;
    }
    updateJob({
      materials: [
        ...job.materials,
        {
          material_id: material.id,
          name: material.name,
          qty: material.default_qty,
          unit: material.unit,
          unit_price: material.unit_price,
          currency: material.currency,
          line_cost: material.default_qty * material.unit_price,
        },
      ],
    });
    setSelectedMaterial("");
  };
  
  const deleteJob = async () => {
    if (!job) return;
    if (!window.confirm(`Hapus Job ${job.name} secara permanen? Semua data langkah kerja dan material job ini akan ikut terhapus.`)) return;
    try {
      await apiFetch(`/jobs/${job.id}`, { method: "DELETE" });
      setJobs(jobs.filter((j) => j.id !== job.id));
      setToast("Job berhasil dihapus dari database.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Gagal menghapus Job.");
    }
  };
  
  const addJob = () => {
    const id = `job-${Date.now()}`;
    const newJob: Job = {
      id,
      name: "Job Baru",
      product: "",
      product_code: "",
      target: 0,
      unit: "Liter",
      shift: "",
      area: "",
      line: "",
      version: 1,
      status: "Draft",
      updated: fmtDate(Date.now()),
      materials: [],
      packagings: [],
      steps: [],
    };
    setDraftJob(newJob);
    setModalTab("details");
    setIsModalOpen(true);
  };

  const copyJob = (sourceJob: Job) => {
    const id = `job-${Date.now()}`;
    const newJob: Job = {
      ...sourceJob,
      id,
      name: `${sourceJob.name} (Copy)`,
      product_code: sourceJob.product_code ? `${sourceJob.product_code}-COPY` : "",
      status: "Draft",
      version: 1,
      updated: fmtDate(Date.now()),
      // Deep copy nested arrays to prevent reference sharing
      materials: (sourceJob.materials || []).map(m => ({ ...m })),
      packagings: (sourceJob.packagings || []).map(p => ({ ...p })),
      steps: (sourceJob.steps || []).map((s, index) => ({
        ...s,
        id: `step-${Date.now()}-${index}`
      })),
    };
    setDraftJob(newJob);
    setModalTab("details");
    setIsModalOpen(true);
    setToast(`Job "${sourceJob.name}" berhasil disalin ke draf.`);
  };

  const saveNewJob = async () => {
    if (!draftJob) return;
    
    try {
      await apiFetch("/jobs", {
        method: "POST",
        body: JSON.stringify({
          ...draftJob,
          popup_enabled: draftJob.popupEnabled,
          popup_title: draftJob.popupTitle,
          popup_message: draftJob.popupMessage,
          allow_overdrive: draftJob.allowOverdrive !== false,
        }),
      });
      setJobs((current) => [...current, draftJob]);
      setSelected(jobs.length);
      setIsModalOpen(false);
      setDraftJob(null);
      setToast("Job Draft baru berhasil dibuat dan disimpan.");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Gagal membuat job baru");
    }
  };

  const publishNewJob = async () => {
    if (!draftJob) return;
    
    if ((draftJob.steps || []).length === 0) {
      setToast("Gagal mempublish: Instruksi kerja harus memiliki minimal 1 langkah kerja.");
      return;
    }

    try {
      const publishedDraft = { ...draftJob, status: "Published" as Job["status"] };
      await apiFetch("/jobs", {
        method: "POST",
        body: JSON.stringify({
          ...publishedDraft,
          popup_enabled: publishedDraft.popupEnabled,
          popup_title: publishedDraft.popupTitle,
          popup_message: publishedDraft.popupMessage,
          allow_overdrive: publishedDraft.allowOverdrive !== false,
        }),
      });
      setJobs((current) => [...current, publishedDraft]);
      setSelected(jobs.length);
      setIsModalOpen(false);
      setDraftJob(null);
      setToast("Job baru berhasil dibuat dan langsung dipublish.");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Gagal mempublish job baru");
    }
  };

  const cancelNewJob = () => {
    setIsModalOpen(false);
    setDraftJob(null);
  };
  

  const updateDraft = (patch: Partial<Job>) => {
    if (!draftJob) return;
    setDraftJob({ ...draftJob, ...patch });
  };

  const addDraftStep = () => {
    if (!draftJob) return;
    const next = (draftJob.steps || []).length + 1;
    const step = {
      id: `step-${Date.now()}`,
      title: `Langkah ${next}`,
      instruction: "Tuliskan instruksi kerja...",
      warning: "",
      duration: 60,
      action: "Selesai",
      allow_overdrive: true,
      loop_warning: true,
    };
    setDraftJob({ ...draftJob, steps: [...(draftJob.steps || []), step] });
  };

  const updateDraftStep = (index: number, patch: Partial<Step>) => {
    if (!draftJob) return;
    setDraftJob({
      ...draftJob,
      steps: (draftJob.steps || []).map((s, i) => (i === index ? { ...s, ...patch } : s)),
    });
  };

  const addMaterialToDraft = () => {
    if (!draftJob) return;
    const material = materialMaster.find((m) => m.id === selectedMaterial);
    if (!material) {
      setToast("Pilih material dari Material Master terlebih dahulu.");
      return;
    }
    if (draftJob.materials.some((m) => m.material_id === material.id)) {
      setToast("Material tersebut sudah ada di draft job.");
      return;
    }
    setDraftJob({
      ...draftJob,
      materials: [
        ...draftJob.materials,
        {
          material_id: material.id,
          name: material.name,
          qty: material.default_qty,
          unit: material.unit,
          unit_price: material.unit_price,
          currency: material.currency,
          line_cost: material.default_qty * material.unit_price,
        },
      ],
    });
    setSelectedMaterial("");
  };

const addPackaging = () => {
    if (!job) return;
    const pkg = packagingMaster.find((item) => item.id === selectedPackaging);
    if (!pkg) {
      setToast("Tambahkan Master Kemasan aktif terlebih dahulu.");
      return;
    }
    if (job.packagings?.some((item) => item.packaging_id === pkg.id)) {
      setToast("Kemasan tersebut sudah ada di Job.");
      return;
    }
    updateJob({
      packagings: [
        ...(job.packagings || []),
        {
          packaging_id: pkg.id,
          name: pkg.name,
          qty: pkg.default_qty || 0,
          unit: pkg.unit || "Unit",
          unit_price: pkg.unit_price,
        },
      ],
    });
    setSelectedPackaging("");
  };

  const addPackagingToDraft = () => {
    if (!draftJob) return;
    const pkg = packagingMaster.find((p) => p.id === selectedPackaging);
    if (!pkg) {
      setToast("Pilih kemasan dari Master Kemasan terlebih dahulu.");
      return;
    }
    if (draftJob.packagings?.some((item) => item.packaging_id === pkg.id)) {
      setToast("Kemasan tersebut sudah ada di checklist draft.");
      return;
    }
    setDraftJob({
      ...draftJob,
      packagings: [
        ...(draftJob.packagings || []),
        {
          packaging_id: pkg.id,
          name: pkg.name,
          qty: pkg.default_qty || 0,
          unit: pkg.unit || "Unit",
          unit_price: pkg.unit_price,
        },
      ],
    });
    setSelectedPackaging("");
  };
  
  const updateStep = (index: number, patch: Partial<Step>) => {
    if (!job) return;
    updateJob({
      steps: (job.steps || []).map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    });
  };
  
  const updateMaterial = (index: number, patch: Partial<Material>) => {
    if (!job) return;
    updateJob({
      materials: job.materials.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    });
  };

  const updatePackaging = (index: number, patch: Partial<Packaging>) => {
    if (!job) return;
    updateJob({
      packagings: (job.packagings || []).map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    });
  };
  
  // ─── Edit-modal state (for existing job) ─────────────────────────────────
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTab, setEditTab] = useState<"details" | "steps" | "materials" | "packagings" | "sounds" | "summary">("details");
  const [modalTab, setModalTab] = useState<"details" | "steps" | "materials" | "packagings" | "sounds" | "summary">("details");

  const playSoundById = (id?: string) => {
    if (!id) return;
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      } catch (err) {
        console.warn("Gagal menghentikan audio sebelumnya:", err);
      }
      activeAudioRef.current = null;
    }
    const sound = availableSounds.find((s) => s.id === id);
    if (sound) {
      const audio = new Audio(`/api/sounds/file/${sound.filename}`);
      activeAudioRef.current = audio;
      audio.play().catch(console.error);
    }
  };

  const renderSoundsTab = (
    currentJob: Job | null,
    onUpdate: (patch: Partial<Job>) => void,
  ) => {
    if (!currentJob) return null;
    return (
      <div className="jm-sounds-tab" style={{ maxWidth: "600px", margin: "0 auto" }}>
        <div className="jm-form-section">
          <p className="jm-section-label">Suara Notifikasi Level Job</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginTop: "1rem" }}>
            {[
              {
                label: "Suara Bawaan Step Selesai",
                desc: "Diputar ketika operator menyelesaikan langkah kerja jika tidak ada suara khusus per langkah.",
                field: "sound_step_completed_id" as keyof Job,
              },
              {
                label: "Suara Job Selesai",
                desc: "Diputar ketika semua langkah kerja selesai dan batch ditutup.",
                field: "sound_job_completed_id" as keyof Job,
              },
              {
                label: "Suara Job Di-pause",
                desc: "Diputar ketika operator mem-pause waktu kerja.",
                field: "sound_paused_id" as keyof Job,
              },
              {
                label: "Suara Job Di-stop",
                desc: "Diputar ketika operator menghentikan job.",
                field: "sound_stopped_id" as keyof Job,
              },
            ].map(({ label, desc, field }) => (
              <div key={field} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontWeight: 600, fontSize: "13px" }}>{label}</span>
                  <span style={{ color: "#6b7280", fontSize: "11px" }}>{desc}</span>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <select
                    style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                    value={(currentJob[field] as string) || ""}
                    onChange={(e) => onUpdate({ [field]: e.target.value || undefined })}
                  >
                    <option value="">-- Gunakan Suara Bawaan Sistem --</option>
                    {availableSounds.map((sound) => (
                      <option key={sound.id} value={sound.id}>
                        {sound.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    disabled={!currentJob[field]}
                    onClick={() => playSoundById(currentJob[field] as string)}
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "40px" }}
                    title="Putar Contoh"
                  >
                    <i className="bi bi-play-fill" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const openEditModal = (index: number) => {
    setSelected(index);
    setEditTab("details");
    setEditModalOpen(true);
  };
  const closeEditModal = () => {
    setEditModalOpen(false);
    setSelected(-1);
  };
  
  const estimatedMaterialCost = selected >= 0 && jobs[selected]
    ? jobs[selected].materials.reduce((sum, material) => {
        const master = materialMaster.find(
          (item) => item.id === material.material_id,
        );
        return (
          sum +
          Number(material.qty || 0) *
            Number(master?.unit_price ?? material.unit_price ?? 0)
        );
      }, 0)
    : 0;
    
  const draftEstimatedCost = draftJob 
    ? draftJob.materials.reduce((sum, material) => {
        const master = materialMaster.find((item) => item.id === material.material_id);
        return sum + Number(material.qty || 0) * Number(master?.unit_price ?? material.unit_price ?? 0);
      }, 0)
    : 0;

  const job = selected >= 0 ? jobs[selected] : null;

  // ─── Helper: render steps tab inside modal ────────────────────────────────
  const renderStepsTab = (
    steps: Step[],
    onAddStep: () => void,
    onUpdateStep: (i: number, p: Partial<Step>) => void,
    onDeleteStep: (i: number) => void,
  ) => (
    <div className="jm-steps-tab">
      <div className="jm-steps-toolbar">
        <span><i className="bi bi-list-ol" /> {steps.length} Langkah Terdaftar</span>
        <button className="btn btn-primary btn-sm" onClick={onAddStep}>
          <i className="bi bi-plus-lg" /> Tambah Step Baru
        </button>
      </div>
      {steps.length === 0 && (
        <div className="jm-empty-state">
          <i className="bi bi-layout-text-window" />
          <p>Belum ada langkah kerja untuk job ini.</p>
          <button className="btn btn-primary" onClick={onAddStep} style={{ marginTop: "1rem" }}>
            <i className="bi bi-plus-lg" /> Tambah Langkah Pertama
          </button>
        </div>
      )}
      {steps.map((s, i) => {
        const { name, qty, unit } = parseStepTitle(s.title);
        return (
          <div key={s.id} className="jm-step-card">
            <div className="jm-step-num">{i + 1}</div>
            <div className="jm-step-body">
              <div className="jm-step-row" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", width: "100%" }}>
                <input
                  style={{ flex: "2 1 180px" }}
                  className="jm-step-title-input"
                  placeholder="Nama Langkah / Bahan (Contoh: TX1)"
                  value={name}
                  onChange={(e) => {
                    const newName = e.target.value;
                    const newTitle = formatStepTitle(newName, qty, unit);
                    onUpdateStep(i, { title: newTitle });
                  }}
                />
                <input
                  type="text"
                  style={{ flex: "0 0 65px", width: "65px", padding: "8px 4px", textAlign: "center" }}
                  className="jm-step-title-input"
                  placeholder="Jumlah"
                  value={qty}
                  onChange={(e) => {
                    const newQty = e.target.value;
                    const newTitle = formatStepTitle(name, newQty, unit);
                    onUpdateStep(i, { title: newTitle });
                  }}
                />
                <select
                  style={{ flex: "0 0 100px", width: "100px", padding: "8px 4px", borderRadius: "8px", border: "1.5px solid var(--border, #e5e7eb)", background: "#fff", fontSize: "12.5px", fontWeight: 500, color: "var(--text)" }}
                  value={unit}
                  onChange={(e) => {
                    const newUnit = e.target.value;
                    const newTitle = formatStepTitle(name, qty, newUnit);
                    onUpdateStep(i, { title: newTitle });
                  }}
                >
                  <option value="">Tidak ada satuan</option>
                  {masterUnits.map((u) => (
                    <option key={u.id} value={u.name}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <label className="jm-step-duration" title="Estimasi durasi (detik)" style={{ flexShrink: 0 }}>
                  <i className="bi bi-stopwatch" />
                  <input
                    type="number"
                    value={s.duration}
                    onChange={(e) => onUpdateStep(i, { duration: Number(e.target.value) })}
                  />
                  <span>dtk</span>
                </label>
                <button
                  className="jm-step-del"
                  onClick={() => onDeleteStep(i)}
                  title="Hapus step"
                  style={{ flexShrink: 0 }}
                >
                  <i className="bi bi-trash3" />
                </button>
              </div>
              <textarea
                placeholder="Instruksi operasional untuk langkah ini..."
                value={s.instruction}
                onChange={(e) => onUpdateStep(i, { instruction: e.target.value })}
              />
              <input
                className="jm-step-warning"
                placeholder="⚠ Peringatan K3 / Safety (Opsional)"
                value={s.warning}
                onChange={(e) => onUpdateStep(i, { warning: e.target.value })}
              />
              <div className="jm-step-sound-row" style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", alignItems: "center", marginTop: "1rem", borderTop: "1px dashed #e2e8f0", paddingTop: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: "120px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#475569", whiteSpace: "nowrap" }}>Overdrive:</span>
                  <label style={{ position: 'relative', display: 'inline-block', width: '34px', height: '20px', margin: 0, flexShrink: 0 }}>
                    <input
                      type="checkbox"
                      checked={s.allow_overdrive !== false}
                      onChange={(e) => onUpdateStep(i, { allow_overdrive: e.target.checked })}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, background: s.allow_overdrive !== false ? '#f59e0b' : '#cbd5e1', borderRadius: '20px', transition: '0.2s' }}>
                      <span style={{ position: 'absolute', height: '14px', width: '14px', left: s.allow_overdrive !== false ? '17px' : '3px', bottom: '3px', background: 'white', borderRadius: '50%', transition: '0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                    </span>
                  </label>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: s.allow_overdrive !== false ? '#d97706' : '#64748b', whiteSpace: "nowrap" }}>
                    {s.allow_overdrive !== false ? "Bisa" : "Tidak"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: "135px", borderRight: "1px solid #e2e8f0", paddingRight: "1.25rem" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#475569", whiteSpace: "nowrap" }}>Loop Alarm:</span>
                  <label style={{ position: 'relative', display: 'inline-block', width: '34px', height: '20px', margin: 0, flexShrink: 0 }}>
                    <input
                      type="checkbox"
                      checked={s.loop_warning !== false}
                      onChange={(e) => onUpdateStep(i, { loop_warning: e.target.checked })}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, background: s.loop_warning !== false ? '#3b82f6' : '#cbd5e1', borderRadius: '20px', transition: '0.2s' }}>
                      <span style={{ position: 'absolute', height: '14px', width: '14px', left: s.loop_warning !== false ? '17px' : '3px', bottom: '3px', background: 'white', borderRadius: '50%', transition: '0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                    </span>
                  </label>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: s.loop_warning !== false ? '#2563eb' : '#64748b', whiteSpace: "nowrap" }}>
                    {s.loop_warning !== false ? "Loop" : "Sekali"}
                  </span>
                </div>
                <div style={{ flex: "1 1 200px", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#475569", whiteSpace: "nowrap" }}>Suara Selesai:</span>
                  <select
                    style={{ flex: 1, padding: "5px 10px", fontSize: "12px", borderRadius: "8px", border: "1.5px solid var(--border, #e5e7eb)", background: "#fff", color: "var(--text)", fontWeight: 500, height: "32px", outline: "none" }}
                    value={s.sound_completed_id || ""}
                    onChange={(e) => onUpdateStep(i, { sound_completed_id: e.target.value || undefined })}
                  >
                    <option value="">-- Suara Bawaan Job --</option>
                    {availableSounds.map((sound) => (
                      <option key={sound.id} value={sound.id}>{sound.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    disabled={!s.sound_completed_id}
                    onClick={() => playSoundById(s.sound_completed_id)}
                    style={{ height: "32px", width: "32px", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, borderRadius: "8px", flexShrink: 0 }}
                  >
                    <i className="bi bi-play-fill" style={{ fontSize: "14px" }} />
                  </button>
                </div>
                <div style={{ flex: "1 1 200px", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#475569", whiteSpace: "nowrap" }}>Alarm Warning:</span>
                  <select
                    style={{ flex: 1, padding: "5px 10px", fontSize: "12px", borderRadius: "8px", border: "1.5px solid var(--border, #e5e7eb)", background: "#fff", color: "var(--text)", fontWeight: 500, height: "32px", outline: "none" }}
                    value={s.sound_warning_id || ""}
                    onChange={(e) => onUpdateStep(i, { sound_warning_id: e.target.value || undefined })}
                  >
                    <option value="">-- Tanpa Alarm Peringatan --</option>
                    {availableSounds.map((sound) => (
                      <option key={sound.id} value={sound.id}>{sound.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    disabled={!s.sound_warning_id}
                    onClick={() => playSoundById(s.sound_warning_id)}
                    style={{ height: "32px", width: "32px", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, borderRadius: "8px", flexShrink: 0 }}
                  >
                    <i className="bi bi-play-fill" style={{ fontSize: "14px" }} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {steps.length > 0 && (
        <div style={{ marginTop: "1rem", textAlign: "center" }}>
          <button className="btn btn-light" onClick={onAddStep} style={{ width: "100%", padding: "0.85rem", borderStyle: "dashed", borderWidth: "2px", borderColor: "#cbd5e1", color: "#475569", fontWeight: 600 }}>
            <i className="bi bi-plus-lg" /> Tambah Step Baru Berikutnya
          </button>
        </div>
      )}
    </div>
  );
    // ─── Helper: render packagings tab inside modal ───────────────────────────
  const renderPackagingsTab = (
    selectedPkgs: Packaging[],
    onAdd: () => void,
    onRemove: (i: number) => void,
    onUpdatePkg: (i: number, p: Partial<Packaging>) => void,
  ) => (
    <div className="jm-materials-tab">
      <div className="jm-mat-picker-section">
        <div className="jm-mat-picker-head">
          <span><i className="bi bi-boxes" /> Pilih dari Packaging Master</span>
          <small>Klik pada baris packaging untuk memilih</small>
        </div>
        <div className="material-option-table-wrapper">
          <table className="material-option-table">
            <thead>
              <tr>
                <th style={{ width: "40px" }}></th>
                <th>Kode</th>
                <th>Nama Packaging</th>
                <th>Stok</th>
                <th>Satuan</th>
                {isSuperUser && <th>Harga Satuan</th>}
                <th style={{ textAlign: "right", paddingRight: "1.5rem" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {packagingMaster.map((mat) => {
                const used = selectedPkgs.some((m) => m.packaging_id === mat.id);
                const isSel = selectedPackaging === mat.id;
                return (
                  <tr
                    key={mat.id}
                    className={`${isSel ? "selected" : ""} ${used ? "used" : ""}`}
                    onClick={() => !used && setSelectedPackaging(mat.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (!used && (e.key === "Enter" || e.key === " ")) setSelectedPackaging(mat.id); }}
                  >
                    <td>
                      <span className="material-card-icon">
                        <i className={`bi ${isSel || used ? "bi-check2-circle" : "bi-box-seam"}`} />
                      </span>
                    </td>
                    <td><strong style={{ fontSize: "16px", color: "var(--text-main)", fontWeight: 800 }}>{mat.code}</strong></td>
                    <td>
                      <span style={{ color: "var(--text-main)", fontSize: "13.5px", fontWeight: 500 }}>{mat.name}</span>
                      <div className="material-option-description">Stok: {Number(mat.initial_stock || 0).toLocaleString("id-ID")} {mat.unit}</div>
                    </td>
                    <td><strong style={{ color: "var(--blue)" }}>{Number(mat.initial_stock || 0).toLocaleString("id-ID")}</strong></td>
                    <td>{mat.unit}</td>
                    {isSuperUser && <td>{fmtRupiah(mat.unit_price)}</td>}
                    <td className="material-option-table-action" style={{ textAlign: "right", paddingRight: "1.5rem" }}>
                      {used ? (
                        <span style={{ color: "#16a34a" }}><i className="bi bi-check-circle-fill" /> Dipakai</span>
                      ) : isSel ? (
                        <span style={{ color: "#2563eb" }}><i className="bi bi-check-circle-fill" /> Terpilih</span>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>Pilih</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {packagingMaster.length === 0 && (
                <tr>
                  <td colSpan={isSuperUser ? 7 : 6} style={{ textAlign: "center", padding: "2rem" }}>
                    <i className="bi bi-database-exclamation" style={{ fontSize: 24, color: "var(--muted)", marginBottom: 8, display: "block" }}></i>
                    Packaging Master kosong atau belum dimuat
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.25rem" }}>
          <button className="btn btn-primary" disabled={!selectedPackaging} onClick={onAdd} style={{ padding: "0.6rem 1.25rem" }}>
            <i className="bi bi-plus-lg" /> Tambah ke Checklist Job
          </button>
        </div>
      </div>
      
      <div className="jm-mat-selected-section">
        <div className="jm-mat-picker-head">
          <span><i className="bi bi-list-check" /> Checklist Kemasan Untuk Job Ini</span>
          <small>{selectedPkgs.length} packaging terdaftar</small>
        </div>
        <div className="table-wrapper">
          <table className="jm-checklist-table" style={{ border: "1.5px solid var(--border)", borderRadius: "10px", overflow: "hidden" }}>
            <thead style={{ background: "#f8fafc" }}>
              <tr>
                <th style={{ width: "50px", textAlign: "center" }}>No</th>
                <th>Kemasan</th>
                <th>Qty per Batch</th>
                <th>Satuan</th>
                <th style={{ textAlign: "center" }}>Hapus</th>
              </tr>
            </thead>
            <tbody>
              {selectedPkgs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "2.5rem", color: "var(--muted)" }}>
                    <i className="bi bi-basket3" style={{ display: "block", fontSize: 28, marginBottom: 12, opacity: 0.4 }} />
                    Belum ada kemasan ditambahkan ke job ini.
                  </td>
                </tr>
              ) : (
                selectedPkgs.map((m, idx) => {
                  const master = packagingMaster.find((mm) => mm.id === m.packaging_id);
                  return (
                    <tr key={`${m.packaging_id}-${idx}`}>
                      <td style={{ textAlign: "center" }}><strong>{idx + 1}</strong></td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <strong style={{ fontSize: '15px', color: 'var(--text-main)', fontWeight: 800 }}>{master?.code || "CUSTOM"}</strong>
                          <span style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 500 }}>{m.name}</span>
                        </div>
                        {isSuperUser && (
                          <div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 2 }}>
                            {fmtRupiah(master?.unit_price ?? m.unit_price ?? 0)} / {m.unit}
                          </div>
                        )}
                      </td>
                      <td>
                        <input
                          type="number" min="0" step="0.01" value={m.qty}
                          onChange={(e) => onUpdatePkg(idx, { qty: Number(e.target.value) })}
                          style={{ width: 90, padding: "6px 10px", borderRadius: 8, border: "1.5px solid var(--border)", outline: "none", fontWeight: 600 }}
                          onFocus={(e) => e.target.style.borderColor = "#2563eb"}
                          onBlur={(e) => e.target.style.borderColor = "var(--border)"}
                        />
                      </td>
                      <td>
                        <select
                          value={m.unit}
                          onChange={(e) => onUpdatePkg(idx, { unit: e.target.value })}
                          style={{ padding: "6px 10px", borderRadius: 8, border: "1.5px solid var(--border)", background: "white", outline: "none", fontWeight: 500 }}
                          onFocus={(e) => e.target.style.borderColor = "#2563eb"}
                          onBlur={(e) => e.target.style.borderColor = "var(--border)"}
                        >
                          <option value="">Pilih</option>
                          {masterUnits.map((u) => (
                            <option key={u.id} value={u.name}>{u.name}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button className="btn btn-sm btn-light danger-button" onClick={() => onRemove(idx)} title="Hapus packaging">
                          <i className="bi bi-trash3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );



  // ─── Helper: render materials tab inside modal ────────────────────────────
  const renderMaterialsTab = (
    selectedMats: Material[],
    onAdd: () => void,
    onRemove: (i: number) => void,
    onUpdateMat: (i: number, p: Partial<Material>) => void,
  ) => (
    <div className="jm-materials-tab">
      <div className="jm-mat-picker-section">
        <div className="jm-mat-picker-head">
          <span><i className="bi bi-boxes" /> Pilih dari Material Master</span>
          <small>Klik pada baris material untuk memilih</small>
        </div>
        <div className="material-option-table-wrapper">
          <table className="material-option-table">
            <thead>
              <tr>
                <th style={{ width: "40px" }}></th>
                <th>Kode</th>
                <th>Nama Material</th>
                <th>Default Qty</th>
                <th>Satuan</th>
                {isSuperUser && <th>Harga Satuan</th>}
                <th style={{ textAlign: "right", paddingRight: "1.5rem" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {materialMaster.map((mat) => {
                const used = selectedMats.some((m) => m.material_id === mat.id);
                const isSel = selectedMaterial === mat.id;
                return (
                  <tr
                    key={mat.id}
                    className={`${isSel ? "selected" : ""} ${used ? "used" : ""}`}
                    onClick={() => !used && setSelectedMaterial(mat.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (!used && (e.key === "Enter" || e.key === " ")) setSelectedMaterial(mat.id); }}
                  >
                    <td>
                      <span className="material-card-icon">
                        <i className={`bi ${isSel || used ? "bi-check2-circle" : "bi-box-seam"}`} />
                      </span>
                    </td>
                    <td><strong style={{ fontSize: "16px", color: "var(--text-main)", fontWeight: 800 }}>{mat.code}</strong></td>
                    <td>
                      <span style={{ color: "var(--text-main)", fontSize: "13.5px", fontWeight: 500 }}>{mat.name}</span>
                      <div className="material-option-description">Default {mat.default_qty} {mat.unit}</div>
                    </td>
                    <td>{mat.default_qty}</td>
                    <td>{mat.unit}</td>
                    {isSuperUser && <td>{fmtRupiah(mat.unit_price)}</td>}
                    <td className="material-option-table-action" style={{ textAlign: "right", paddingRight: "1.5rem" }}>
                      {used ? (
                        <span style={{ color: "#16a34a" }}><i className="bi bi-check-circle-fill" /> Dipakai</span>
                      ) : isSel ? (
                        <span style={{ color: "#2563eb" }}><i className="bi bi-check-circle-fill" /> Terpilih</span>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>Pilih</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {materialMaster.length === 0 && (
                <tr>
                  <td colSpan={isSuperUser ? 7 : 6} style={{ textAlign: "center", padding: "2rem" }}>
                    <i className="bi bi-database-exclamation" style={{ fontSize: 24, color: "var(--muted)", marginBottom: 8, display: "block" }}></i>
                    Material Master kosong atau belum dimuat
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.25rem" }}>
          <button className="btn btn-primary" disabled={!selectedMaterial} onClick={onAdd} style={{ padding: "0.6rem 1.25rem" }}>
            <i className="bi bi-plus-lg" /> Tambah ke Checklist Job
          </button>
        </div>
      </div>
      
      <div className="jm-mat-selected-section">
        <div className="jm-mat-picker-head">
          <span><i className="bi bi-list-check" /> Checklist Bahan Untuk Job Ini</span>
          <small>{selectedMats.length} material terdaftar</small>
        </div>
        <div className="table-wrapper">
          <table className="jm-checklist-table" style={{ border: "1.5px solid var(--border)", borderRadius: "10px", overflow: "hidden" }}>
            <thead style={{ background: "#f8fafc" }}>
              <tr>
                <th style={{ width: "50px", textAlign: "center" }}>No</th>
                <th>Bahan Baku</th>
                <th>Qty per Batch</th>
                <th>Satuan</th>
                <th style={{ textAlign: "center" }}>Hapus</th>
              </tr>
            </thead>
            <tbody>
              {selectedMats.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "2.5rem", color: "var(--muted)" }}>
                    <i className="bi bi-basket3" style={{ display: "block", fontSize: 28, marginBottom: 12, opacity: 0.4 }} />
                    Belum ada bahan ditambahkan ke job ini.
                  </td>
                </tr>
              ) : (
                selectedMats.map((m, idx) => {
                  const master = materialMaster.find((mm) => mm.id === m.material_id);
                  return (
                    <tr key={`${m.material_id}-${idx}`}>
                      <td style={{ textAlign: "center" }}><strong>{idx + 1}</strong></td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <strong style={{ fontSize: '15px', color: 'var(--text-main)', fontWeight: 800 }}>{master?.code || "CUSTOM"}</strong>
                          <span style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 500 }}>{m.name}</span>
                        </div>
                        {isSuperUser && (
                          <div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 2 }}>
                            {fmtRupiah(master?.unit_price ?? m.unit_price ?? 0)} / {m.unit}
                          </div>
                        )}
                      </td>
                      <td>
                        <input
                          type="number" min="0" step="0.01" value={m.qty}
                          onChange={(e) => onUpdateMat(idx, { qty: Number(e.target.value) })}
                          style={{ width: 90, padding: "6px 10px", borderRadius: 8, border: "1.5px solid var(--border)", outline: "none", fontWeight: 600 }}
                          onFocus={(e) => e.target.style.borderColor = "#2563eb"}
                          onBlur={(e) => e.target.style.borderColor = "var(--border)"}
                        />
                      </td>
                      <td>
                        <select
                          value={m.unit}
                          onChange={(e) => onUpdateMat(idx, { unit: e.target.value })}
                          style={{ padding: "6px 10px", borderRadius: 8, border: "1.5px solid var(--border)", background: "white", outline: "none", fontWeight: 500 }}
                          onFocus={(e) => e.target.style.borderColor = "#2563eb"}
                          onBlur={(e) => e.target.style.borderColor = "var(--border)"}
                        >
                          <option value="">Pilih</option>
                          {masterUnits.map((u) => (
                            <option key={u.id} value={u.name}>{u.name}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button className="btn btn-sm btn-light danger-button" onClick={() => onRemove(idx)} title="Hapus material">
                          <i className="bi bi-trash3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <p className="section-kicker">MASTER & VERSIONING</p>
          <h1>Job Library</h1>
          <p>Kelola instruksi kerja, komposisi bahan, dan parameter operasional.</p>
        </div>
        <div className="header-actions">
          <TutorialButton tutorialKey="jobs" />
          <div className="jm-search-box">
            <i className="bi bi-search" />
            <input value={jobSearch} onChange={(e) => setJobSearch(e.target.value)} placeholder="Cari instruksi kerja..." />
          </div>
          <button className="btn btn-primary" onClick={addJob} style={{ padding: "0.6rem 1.25rem", gap: "0.5rem" }}>
            <i className="bi bi-plus-lg" /> Buat Job Baru
          </button>
        </div>
      </div>

      <section className="panel table-panel" style={{ marginTop: "1.5rem" }}>
        <div className="table-wrapper">
          <table style={{ borderCollapse: "separate", borderSpacing: "0", minWidth: "100%" }}>
            <thead style={{ background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)" }}>
              <tr>
                <th style={{ width: "50px", textAlign: "center", borderBottom: "1px solid var(--border)" }}>No</th>
                <th style={{ borderBottom: "1px solid var(--border)" }}>Nama Job</th>
                <th style={{ borderBottom: "1px solid var(--border)" }}>Produk Output</th>
                <th style={{ borderBottom: "1px solid var(--border)" }}>Target</th>
                <th style={{ borderBottom: "1px solid var(--border)", textAlign: "center" }}>Langkah</th>
                <th style={{ borderBottom: "1px solid var(--border)", textAlign: "center" }}>Bahan</th>
                <th style={{ borderBottom: "1px solid var(--border)", textAlign: "center" }}>Versi</th>
                <th style={{ borderBottom: "1px solid var(--border)" }}>Status</th>
                <th style={{ borderBottom: "1px solid var(--border)" }}>Update Terakhir</th>
                <th style={{ borderBottom: "1px solid var(--border)", textAlign: "center" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", padding: "4rem", color: "var(--muted)" }}>
                    <i className="bi bi-journal-x" style={{ fontSize: 36, display: "block", marginBottom: 12, opacity: 0.5 }} />
                    <p style={{ margin: 0, fontWeight: 500 }}>{jobSearch ? "Tidak ada instruksi kerja yang cocok dengan pencarian." : "Belum ada instruksi kerja. Klik 'Buat Job Baru' untuk mulai."}</p>
                  </td>
                </tr>
              ) : (
                filteredJobs.map((item) => {
                  const idx = jobIndexFromId(item.id);
                  return (
                    <tr key={item.id} className="jm-table-row" onClick={() => openEditModal(idx)} style={{ cursor: "pointer" }}>
                      <td style={{ textAlign: "center", color: "var(--muted)", fontWeight: 600 }}>{idx + 1}</td>
                      <td>
                        <div className="jm-job-name-cell">
                          <span className="jm-job-icon"><i className="bi bi-card-checklist" /></span>
                          <div>
                            <strong>{item.name}</strong>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{item.product || "—"}</td>
                      <td style={{ fontWeight: 500 }}>{item.target ? `${item.target} ${item.unit}` : "—"}</td>
                      <td style={{ textAlign: "center" }}><span className="jm-count-chip"><i className="bi bi-list-ol" /> {(item.steps || []).length}</span></td>
                      <td style={{ textAlign: "center" }}><span className="jm-count-chip mat"><i className="bi bi-boxes" /> {item.materials.length}</span></td>
                      <td style={{ textAlign: "center" }}><span className="version-chip" style={{ background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1" }}>v{item.version}</span></td>
                      <td><StatusBadge status={item.status} /></td>
                      <td style={{ fontSize: "12.5px", color: "var(--muted)", fontWeight: 500 }}>{item.updated}</td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                          <button className="btn btn-sm btn-light" onClick={(e) => { e.stopPropagation(); openEditModal(idx); }} style={{ padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <i className="bi bi-pencil-square" style={{ color: "#2563eb" }} /> Edit
                          </button>
                          <button className="btn btn-sm btn-light" onClick={(e) => { e.stopPropagation(); copyJob(item); }} style={{ padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: "4px" }} title="Salin/Duplikat Job">
                            <i className="bi bi-copy" style={{ color: "#0d9488" }} /> Salin
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ADD JOB MODAL */}
      {isModalOpen && draftJob && (
        <div className="jm-modal-backdrop" onClick={cancelNewJob}>
          <div className="jm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="jm-modal-header">
              <div>
                <p className="section-kicker">BUAT JOB BARU</p>
                <h2>Instruksi Kerja Baru</h2>
              </div>
              <div className="jm-modal-header-actions">
                <button className="btn btn-light" onClick={cancelNewJob}>Batal</button>
                <button className="btn btn-primary" onClick={() => void saveNewJob()} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <i className="bi bi-floppy" /> Simpan Draft Job
                </button>
                <button className="btn btn-success" onClick={() => void publishNewJob()} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <i className="bi bi-rocket-takeoff" /> Publish Job
                </button>
              </div>
            </div>
            <div className="jm-modal-tabs">
              <button className={modalTab === "details" ? "active" : ""} onClick={() => setModalTab("details")}>
                <i className="bi bi-info-circle" /> Informasi Job
              </button>
              <button className={modalTab === "steps" ? "active" : ""} onClick={() => setModalTab("steps")}>
                <i className="bi bi-signpost-split" /> Langkah Kerja
                {(draftJob.steps || []).length > 0 && <span className="jm-tab-badge">{(draftJob.steps || []).length}</span>}
              </button>
              <button className={modalTab === "materials" ? "active" : ""} onClick={() => setModalTab("materials")}>
                <i className="bi bi-box-seam" /> Material & Bahan
                {draftJob.materials.length > 0 && <span className="jm-tab-badge">{draftJob.materials.length}</span>}
              </button>
              <button className={modalTab === "packagings" ? "active" : ""} onClick={() => setModalTab("packagings")}>
                <i className="bi bi-box" /> Kemasan
                {draftJob.packagings?.length > 0 && <span className="jm-tab-badge">{draftJob.packagings.length}</span>}
              </button>
              <button className={modalTab === "sounds" ? "active" : ""} onClick={() => setModalTab("sounds")}>
                <i className="bi bi-volume-up" /> Suara & Alarm
              </button>
              <button className={modalTab === "summary" ? "active" : ""} onClick={() => setModalTab("summary")}>
                <i className="bi bi-clipboard-check" /> Ringkasan
              </button>
            </div>
            <div className="jm-modal-body">
              {modalTab === "details" && (
                <div style={{ maxWidth: "600px", margin: "0 auto" }}>
                  <div className="jm-form-section">
                    <p className="jm-section-label">Informasi Dasar & Parameter</p>
                    <div className="form-grid">
                      <label>Nama Job / Instruksi<input value={draftJob.name} onChange={(e) => updateDraft({ name: e.target.value })} placeholder="Contoh: Prewash Gen 3.0" /></label>
                      <label>Produk Output<input value={draftJob.product} onChange={(e) => updateDraft({ product: e.target.value })} placeholder="Nama produk yang dihasilkan" /></label>
                      <label>Kode Produk<input value={draftJob.product_code || ""} onChange={(e) => updateDraft({ product_code: e.target.value })} placeholder="Contoh: SWP20L" /></label>
                      <label>Target per Batch<input type="number" value={draftJob.target} onChange={(e) => updateDraft({ target: Number(e.target.value) })} /></label>
                      <label>Satuan Target
                        <select value={draftJob.unit} onChange={(e) => updateDraft({ unit: e.target.value })}>
                          <option value="">Pilih Satuan</option>
                          {masterUnits.map((u) => (
                            <option key={u.id} value={u.name}>{u.name}</option>
                          ))}
                        </select>
                      </label>
                      
                      <label>Shift Operasional Default
                        <select value={draftJob.shift} onChange={(e) => updateDraft({ shift: e.target.value })}>
                          <option value="">-- Pilih Shift --</option>
                          {masterShifts.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                      </label>

                      <label>Line Operasional
                        <select value={draftJob.line} onChange={(e) => {
                          const val = e.target.value;
                          const selectedLine = masterLines.find(l => l.name === val);
                          const lineArea = selectedLine ? (masterAreas.find(a => a.id === selectedLine.area_id)?.name || "") : "";
                          updateDraft({ line: val, area: lineArea });
                        }}>
                          <option value="">-- Pilih Line --</option>
                          {masterLines.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                        </select>
                      </label>
                    </div>
                  </div>
                </div>
              )}
              {modalTab === "steps" && renderStepsTab(
                (draftJob.steps || []),
                addDraftStep,
                updateDraftStep,
                (i) => setDraftJob({ ...draftJob, steps: (draftJob.steps || []).filter((_, si) => si !== i) }),
              )}
              {modalTab === "materials" && renderMaterialsTab(
                draftJob.materials,
                addMaterialToDraft,
                (i) => setDraftJob({ ...draftJob, materials: draftJob.materials.filter((_, mi) => mi !== i) }),
                (i, p) => setDraftJob({ ...draftJob, materials: draftJob.materials.map((m, mi) => mi === i ? { ...m, ...p } : m) }),
              )}
              {modalTab === "packagings" && renderPackagingsTab(
                draftJob.packagings || [],
                addPackagingToDraft,
                (i) => setDraftJob({ ...draftJob, packagings: (draftJob.packagings || []).filter((_, pi) => pi !== i) }),
                (i, p) => setDraftJob({ ...draftJob, packagings: (draftJob.packagings || []).map((pkg, pi) => pi === i ? { ...pkg, ...p } : pkg) }),
              )}
              {modalTab === "summary" && (
                <div style={{ maxWidth: "600px", margin: "0 auto", padding: "1rem 0" }}>
                  <div className="jm-checklist-section">
                    <p className="jm-section-label">Ringkasan Kesiapan Draft</p>
                    <div className="jm-checklist-card">
                      <div className="jm-checklist-item" style={{ cursor: "pointer" }} onClick={() => setModalTab("steps")}>
                        <i className="bi bi-list-ol" />
                        <span>Langkah Kerja Terdaftar</span>
                        <strong>{(draftJob.steps || []).length} Step</strong>
                        <i className="bi bi-chevron-right" style={{ background: "none", color: "var(--muted)", width: "auto" }} />
                      </div>
                      <div className="jm-checklist-item" style={{ cursor: "pointer" }} onClick={() => setModalTab("materials")}>
                        <i className="bi bi-boxes" />
                        <span>Checklist Bahan Baku</span>
                        <strong>{draftJob.materials.length} Bahan</strong>
                        <i className="bi bi-chevron-right" style={{ background: "none", color: "var(--muted)", width: "auto" }} />
                      </div>
                      {(draftJob.steps || []).length > 0 && draftJob.materials.length > 0 ? (
                        <div className="jm-checklist-ready">
                          <i className="bi bi-check-circle-fill" /> Job draft sudah lengkap dan siap disimpan.
                        </div>
                      ) : (
                        <div className="jm-checklist-ready" style={{ background: "#fffbeb", color: "#b45309", borderTopColor: "#fde68a" }}>
                          <i className="bi bi-exclamation-circle-fill" /> Mohon lengkapi langkah & bahan.
                        </div>
                      )}
                    </div>
                    
                    {isSuperUser && draftEstimatedCost > 0 && (
                      <>
                        <div className="jm-cost-badge">
                          <i className="bi bi-calculator" />
                          <div>
                            <small>Estimasi Cost Bahan</small>
                            <strong>{fmtRupiah(draftEstimatedCost)}</strong>
                          </div>
                        </div>
                        <div style={{ marginTop: '12px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px', overflowX: 'auto' }}>
                          <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b', marginBottom: '8px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
                            Rincian Cost Bahan Baku
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ padding: '6px 4px', color: '#475569', fontWeight: 600 }}>Nama Bahan</th>
                                <th style={{ padding: '6px 4px', color: '#475569', fontWeight: 600, textAlign: 'right' }}>Jumlah</th>
                                <th style={{ padding: '6px 4px', color: '#475569', fontWeight: 600, textAlign: 'right' }}>Harga Satuan</th>
                                <th style={{ padding: '6px 4px', color: '#475569', fontWeight: 600, textAlign: 'right' }}>Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {draftJob.materials.map((m, idx) => {
                                const master = materialMaster.find((item) => item.id === m.material_id);
                                const price = Number(master?.unit_price ?? m.unit_price ?? 0);
                                const subtotal = Number(m.qty || 0) * price;
                                return (
                                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '6px 4px', color: '#1e293b' }}>{m.name}</td>
                                    <td style={{ padding: '6px 4px', color: '#334155', textAlign: 'right' }}>{m.qty} {m.unit}</td>
                                    <td style={{ padding: '6px 4px', color: '#334155', textAlign: 'right' }}>{fmtRupiah(price)}</td>
                                    <td style={{ padding: '6px 4px', color: '#0f172a', fontWeight: 600, textAlign: 'right' }}>{fmtRupiah(subtotal)}</td>
                                  </tr>
                                );
                              })}
                              <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                                <td colSpan={3} style={{ padding: '8px 4px', color: '#1e293b' }}>Total Estimasi Cost</td>
                                <td style={{ padding: '8px 4px', color: '#0f172a', textAlign: 'right' }}>{fmtRupiah(draftEstimatedCost)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                    
                    {draftJob.materials.length > 0 && (
                      <div className="jm-mini-mat-list">
                        <p className="jm-section-label" style={{ marginBottom: "0.5rem", marginTop: "0.5rem" }}>Bahan Terpilih</p>
                        {draftJob.materials.slice(0, 4).map((m, i) => (
                          <div key={i} className="jm-mini-mat-row">
                            <i className="bi bi-check2-square" />
                            <span>{m.name}</span>
                            <small>{m.qty} {m.unit}</small>
                          </div>
                        ))}
                        {draftJob.materials.length > 4 && (
                          <div className="jm-mini-mat-row" style={{ justifyContent: "center", background: "transparent", border: "none" }}>
                            <small style={{ color: "#2563eb", cursor: "pointer" }} onClick={() => setModalTab("materials")}>
                              +{draftJob.materials.length - 4} bahan lainnya...
                            </small>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {modalTab === "sounds" && renderSoundsTab(draftJob, updateDraft)}
            </div>
          </div>
        </div>
      )}

      {/* EDIT JOB MODAL */}
      {editModalOpen && job && (
        <div className="jm-modal-backdrop" onClick={closeEditModal}>
          <div className="jm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="jm-modal-header">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "0.2rem" }}>
                  <p className="section-kicker" style={{ margin: 0 }}>EDIT INSTRUKSI KERJA</p>
                  <span className="version-chip" style={{ fontSize: "10px", padding: "1px 6px" }}>v{job.version}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <h2>{job.name}</h2>
                  <StatusBadge status={job.status} />
                </div>
              </div>
              <div className="jm-modal-header-actions">
                <button className="btn btn-light" onClick={closeEditModal}>Tutup</button>
                {job.status !== "Archived" && (
                  <button className="btn btn-light danger-button" onClick={() => { void deleteJob().then(() => closeEditModal()); }}>
                    <i className="bi bi-trash" /> Hapus
                  </button>
                )}
                <button className="btn btn-light" onClick={() => { void saveDraft().then(() => closeEditModal()); }} style={{ color: "#2563eb", borderColor: "#bfdbfe", background: "#eff6ff" }}>
                  <i className="bi bi-database-check" /> Simpan Perubahan
                </button>
                <button className="btn btn-primary" onClick={() => void publish()}>
                  <i className="bi bi-rocket-takeoff" /> Publish v{job.version + 1}
                </button>
              </div>
            </div>
            <div className="jm-modal-tabs">
              <button className={editTab === "details" ? "active" : ""} onClick={() => setEditTab("details")}>
                <i className="bi bi-info-circle" /> Informasi Job
              </button>
              <button className={editTab === "steps" ? "active" : ""} onClick={() => setEditTab("steps")}>
                <i className="bi bi-signpost-split" /> Langkah Kerja
                <span className="jm-tab-badge">{(job.steps || []).length}</span>
              </button>
              <button className={editTab === "materials" ? "active" : ""} onClick={() => setEditTab("materials")}>
                <i className="bi bi-box-seam" /> Material & Bahan
                <span className="jm-tab-badge">{job.materials.length}</span>
              </button>
              <button className={editTab === "packagings" ? "active" : ""} onClick={() => setEditTab("packagings")}>
                <i className="bi bi-box" /> Kemasan
                <span className="jm-tab-badge">{job.packagings?.length || 0}</span>
              </button>
              <button className={editTab === "sounds" ? "active" : ""} onClick={() => setEditTab("sounds")}>
                <i className="bi bi-volume-up" /> Suara & Alarm
              </button>
              <button className={editTab === "summary" ? "active" : ""} onClick={() => setEditTab("summary")}>
                <i className="bi bi-clipboard-check" /> Ringkasan
              </button>
            </div>
            <div className="jm-modal-body">
              {editTab === "details" && (
                <div style={{ maxWidth: "600px", margin: "0 auto" }}>
                  <div className="jm-form-section">
                    <p className="jm-section-label">Informasi Dasar & Parameter</p>
                    <div className="form-grid">
                      <label>Nama Job / Instruksi<input value={job.name} onChange={(e) => updateJob({ name: e.target.value })} /></label>
                      <label>Produk Output<input value={job.product} onChange={(e) => updateJob({ product: e.target.value })} /></label>
                      <label>Kode Produk<input value={job.product_code || ""} onChange={(e) => updateJob({ product_code: e.target.value })} placeholder="Contoh: SWP20L" /></label>
                      <label>Target per Batch<input type="number" value={job.target} onChange={(e) => updateJob({ target: Number(e.target.value) })} /></label>
                      <label>Satuan Target
                        <select value={job.unit} onChange={(e) => updateJob({ unit: e.target.value })}>
                          <option value="">Pilih Satuan</option>
                          {masterUnits.map((u) => (
                            <option key={u.id} value={u.name}>{u.name}</option>
                          ))}
                        </select>
                      </label>
                      
                      <label>Shift Operasional Default
                        <select value={job.shift} onChange={(e) => updateJob({ shift: e.target.value })}>
                          <option value="">-- Pilih Shift --</option>
                          {masterShifts.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                      </label>

                      <label>Line Operasional
                        <select value={job.line} onChange={(e) => {
                          const val = e.target.value;
                          const selectedLine = masterLines.find(l => l.name === val);
                          const lineArea = selectedLine ? (masterAreas.find(a => a.id === selectedLine.area_id)?.name || "") : "";
                          updateJob({ line: val, area: lineArea });
                        }}>
                          <option value="">-- Pilih Line --</option>
                          {masterLines.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                        </select>
                      </label>

                      <label className="full-width">Status Visibilitas
                        <select value={job.status} onChange={(e) => updateJob({ status: e.target.value as Job["status"] })}>
                          <option value="Draft">Draft (Dalam Pengerjaan)</option>
                          <option value="Published">Published (Aktif di Operator)</option>
                          <option value="Archived">Archived (Diarsipkan)</option>
                        </select>
                      </label>
                    </div>
                  </div>
                </div>
              )}
              {editTab === "steps" && renderStepsTab(
                (job.steps || []),
                addStep,
                updateStep,
                (i) => updateJob({ steps: (job.steps || []).filter((_, si) => si !== i) }),
              )}
              {editTab === "materials" && renderMaterialsTab(
                job.materials,
                addMaterial,
                (i) => updateJob({ materials: job.materials.filter((_, mi) => mi !== i) }),
                updateMaterial,
              )}
              {editTab === "packagings" && renderPackagingsTab(
                job.packagings || [],
                addPackaging,
                (i) => updateJob({ packagings: (job.packagings || []).filter((_, pi) => pi !== i) }),
                updatePackaging,
              )}
              {editTab === "summary" && (
                <div style={{ maxWidth: "600px", margin: "0 auto", padding: "1rem 0" }}>
                  <div className="jm-checklist-section">
                    <p className="jm-section-label">Ringkasan Instruksi</p>
                    <div className="jm-checklist-card">
                      <div className="jm-checklist-item" style={{ cursor: "pointer" }} onClick={() => setEditTab("steps")}>
                        <i className="bi bi-list-ol" />
                        <span>Langkah Kerja Terdaftar</span>
                        <strong>{(job.steps || []).length} Step</strong>
                        <i className="bi bi-chevron-right" style={{ background: "none", color: "var(--muted)", width: "auto" }} />
                      </div>
                      <div className="jm-checklist-item" style={{ cursor: "pointer" }} onClick={() => setEditTab("materials")}>
                        <i className="bi bi-boxes" />
                        <span>Checklist Bahan Baku</span>
                        <strong>{job.materials.length} Bahan</strong>
                        <i className="bi bi-chevron-right" style={{ background: "none", color: "var(--muted)", width: "auto" }} />
                      </div>
                    </div>
                    {isSuperUser && estimatedMaterialCost > 0 && (
                      <>
                        <div className="jm-cost-badge">
                          <i className="bi bi-calculator" />
                          <div>
                            <small>Estimasi Cost Bahan</small>
                            <strong>{fmtRupiah(estimatedMaterialCost)}</strong>
                          </div>
                        </div>
                        <div style={{ marginTop: '12px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px', overflowX: 'auto' }}>
                          <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b', marginBottom: '8px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
                            Rincian Cost Bahan Baku
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ padding: '6px 4px', color: '#475569', fontWeight: 600 }}>Nama Bahan</th>
                                <th style={{ padding: '6px 4px', color: '#475569', fontWeight: 600, textAlign: 'right' }}>Jumlah</th>
                                <th style={{ padding: '6px 4px', color: '#475569', fontWeight: 600, textAlign: 'right' }}>Harga Satuan</th>
                                <th style={{ padding: '6px 4px', color: '#475569', fontWeight: 600, textAlign: 'right' }}>Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {job.materials.map((m, idx) => {
                                const master = materialMaster.find((item) => item.id === m.material_id);
                                const price = Number(master?.unit_price ?? m.unit_price ?? 0);
                                const subtotal = Number(m.qty || 0) * price;
                                return (
                                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '6px 4px', color: '#1e293b' }}>{m.name}</td>
                                    <td style={{ padding: '6px 4px', color: '#334155', textAlign: 'right' }}>{m.qty} {m.unit}</td>
                                    <td style={{ padding: '6px 4px', color: '#334155', textAlign: 'right' }}>{fmtRupiah(price)}</td>
                                    <td style={{ padding: '6px 4px', color: '#0f172a', fontWeight: 600, textAlign: 'right' }}>{fmtRupiah(subtotal)}</td>
                                  </tr>
                                );
                              })}
                              <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                                <td colSpan={3} style={{ padding: '8px 4px', color: '#1e293b' }}>Total Estimasi Cost</td>
                                <td style={{ padding: '8px 4px', color: '#0f172a', textAlign: 'right' }}>{fmtRupiah(estimatedMaterialCost)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                    {job.materials.length > 0 && (
                      <div className="jm-mini-mat-list">
                        <p className="jm-section-label" style={{ marginBottom: "0.5rem", marginTop: "0.5rem" }}>Bahan Terpilih</p>
                        {job.materials.slice(0, 4).map((m, i) => (
                          <div key={i} className="jm-mini-mat-row">
                            <i className="bi bi-check2-square" />
                            <span>{m.name}</span>
                            <small>{m.qty} {m.unit}</small>
                          </div>
                        ))}
                        {job.materials.length > 4 && (
                          <div className="jm-mini-mat-row" style={{ justifyContent: "center", background: "transparent", border: "none" }}>
                            <small style={{ color: "#2563eb", cursor: "pointer" }} onClick={() => setEditTab("materials")}>
                              +{job.materials.length - 4} bahan lainnya...
                            </small>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {editTab === "sounds" && renderSoundsTab(job, updateJob)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



function BatchTable({
  title,
  subtitle,
  history,
  query,
  setQuery,
}: {
  title: string;
  subtitle: string;
  history: HistoryRow[];
  query: string;
  setQuery: (value: string) => void;
}) {
  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <p className="section-kicker">TRACEABILITY</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="search-box">
            <i className="bi bi-search" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari batch, Job, operator..."
            />
          </div>
          <button className="btn btn-light">
            <i className="bi bi-funnel" /> Semua Status
          </button>
          <button className="btn btn-light">
            <i className="bi bi-calendar3" /> 16 - 22 Jul 2026
          </button>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Batch No</th>
                <th>Job / Produk</th>
                <th>Operator</th>
                <th>Area</th>
                <th>Output</th>
                <th>Status</th>
                <th>Tanggal</th>
                <th>Durasi</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong className="batch-link">{item.id}</strong>
                  </td>
                  <td>
                    <strong>{item.job}</strong>
                  </td>
                  <td>{item.operator}</td>
                  <td>{item.area || "-"}</td>
                  <td>{item.output}</td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td>{item.date}</td>
                  <td>{item.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>Menampilkan {history.length} data</span>
          <div>
            <button disabled>
              <i className="bi bi-chevron-left" />
            </button>
            <button className="active">1</button>
            <button>2</button>
            <button>
              <i className="bi bi-chevron-right" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

// Legacy static report retained as a fallback reference for offline prototyping.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Reports({
  history,
  query,
  setQuery,
  exportCsv,
}: {
  history: HistoryRow[];
  query: string;
  setQuery: (value: string) => void;
  exportCsv: () => void;
}) {
  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <p className="section-kicker">REPORT & EXPORT</p>
          <h1>Ringkasan Produksi</h1>
          <p>Filter data operasional dan unduh laporan untuk analisis.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-light" onClick={() => window.print()}>
            <i className="bi bi-printer" /> Print
          </button>
          <button className="btn btn-primary" onClick={exportCsv}>
            <i className="bi bi-download" /> Export CSV
          </button>
        </div>
      </div>
      <div className="report-kpi-row">
        <div>
          <small>Total Batch</small>
          <strong>{history.length + 93}</strong>
          <span>Periode 16 - 22 Jul</span>
        </div>
        <div>
          <small>Total Output</small>
          <strong>22.450 L</strong>
          <span>+9.6% vs periode lalu</span>
        </div>
        <div>
          <small>Average Duration</small>
          <strong>01:08:42</strong>
          <span>Per completed batch</span>
        </div>
        <div>
          <small>Completion Rate</small>
          <strong>98.6%</strong>
          <span>Target ≥ 97%</span>
        </div>
      </div>
      <BatchTable
        title="Data Transaksi"
        subtitle="Kolom penting sesuai RPT-01 Ringkasan Produksi."
        history={history}
        query={query}
        setQuery={setQuery}
      />
    </div>
  );
}

function OverrideModal({
  batch,
  pin,
  setPin,
  reason,
  setReason,
  onSubmit,
  onClose,
  title = "Lanjutkan batch yang dijeda",
  text,
  reasonLabel = "Alasan Resume",
}: {
  batch: Batch;
  pin: string;
  setPin: (value: string) => void;
  reason: string;
  setReason: (value: string) => void;
  onSubmit: (event: FormEvent) => void | Promise<void>;
  onClose: () => void;
  title?: string;
  text?: string;
  reasonLabel?: string;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop-custom">
      <form className="override-modal" onSubmit={handleSubmit}>
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Tutup"
        >
          <i className="bi bi-x-lg" />
        </button>
        <span className="override-icon">
          <i className="bi bi-shield-lock" />
        </span>
        <p className="section-kicker">SUPERVISOR OVERRIDE</p>
        <h2>{title}</h2>
        <p>
          {text || `${batch.id} membutuhkan otorisasi supervisor dan alasan yang akan dicatat di audit log.`}
        </p>
        <label>
          PIN Supervisor
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Gunakan PIN demo: 2468"
          />
        </label>
        <label>
          {reasonLabel}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Contoh: Bahan diperiksa dan proses aman dilanjutkan"
          />
        </label>
        <div>
          <button type="button" className="btn btn-light" onClick={onClose} disabled={isSubmitting}>
            Nanti
          </button>
          <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <i className="bi bi-arrow-repeat spin" style={{ display: 'inline-block' }} /> Memverifikasi...
              </>
            ) : (
              <>
                <i className="bi bi-unlock" /> Otorisasi & Submit
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function LowStockModal({
  items,
  onClose,
}: {
  items: Array<{
    type: "Material" | "Packaging";
    code: string;
    name: string;
    stock: number;
    min_sku: number;
    unit: string;
  }>;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop-custom">
      <div className="low-stock-modal" style={{
        background: '#ffffff',
        width: '95%',
        maxWidth: '700px',
        borderRadius: '16px',
        padding: '24px',
        position: 'relative',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Tutup"
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            border: 'none',
            background: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: '#64748b'
          }}
        >
          <i className="bi bi-x-lg" />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            backgroundColor: '#fee2e2',
            color: '#ef4444',
            borderRadius: '12px',
            width: '48px',
            height: '48px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px'
          }}>
            <i className="bi bi-exclamation-triangle-fill" />
          </span>
          <div>
            <p className="section-kicker" style={{ margin: 0, color: '#ef4444', fontWeight: 700, fontSize: '12px', letterSpacing: '0.05em' }}>PERINGATAN STOK MINIMAL</p>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>Material & Kemasan Kritis</h2>
          </div>
        </div>
        
        <p style={{ margin: 0, color: '#475569', fontSize: '14px', lineHeight: '1.5' }}>
          Berikut daftar bahan baku dan kemasan aktif yang telah mencapai atau berada di bawah ambang batas minimal SKU.
        </p>

        <div style={{
          maxHeight: '350px',
          overflowY: 'auto',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          background: '#f8fafc'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Tipe</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Kode</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Nama</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Stok Aktual</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Minimal SKU</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Satuan</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? (
                items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: idx < items.length - 1 ? '1px solid #e2e8f0' : 'none', background: '#fff' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-flex',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: item.type === "Material" ? '#e0f2fe' : '#fae8ff',
                        color: item.type === "Material" ? '#0369a1' : '#a21caf'
                      }}>
                        {item.type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>{item.code}</td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>{item.name}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>
                      {item.stock.toLocaleString("id-ID")}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#64748b' }}>
                      {item.min_sku.toLocaleString("id-ID")}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{item.unit}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                    Semua material dan kemasan dalam kondisi aman.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onClose}
            style={{ padding: '10px 20px', borderRadius: '8px', fontWeight: 600 }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

function CancelBatchModal({
  batch,
  role,
  pin,
  setPin,
  reason,
  setReason,
  onSubmit,
  onClose,
}: {
  batch: Batch;
  role: Role;
  pin: string;
  setPin: (value: string) => void;
  reason: string;
  setReason: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
}) {
  const needsPin = role === "operator";
  return (
    <div className="modal-backdrop-custom">
      <form className="cancel-batch-modal" onSubmit={onSubmit}>
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Tutup"
        >
          <i className="bi bi-x-lg" />
        </button>
        <span className="cancel-modal-icon">
          <i className="bi bi-x-octagon" />
        </span>
        <p className="section-kicker">PEMBATALAN TERKONTROL</p>
        <h2>Batalkan Job aktif?</h2>
        <p>
          Batch <strong>{batch.id}</strong> · {batch.jobSnapshot.name} akan
          dihentikan dan tetap tersimpan pada audit trail.
        </p>
        {needsPin && (
          <label>
            PIN Supervisor
            <input
              required
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              placeholder="Masukkan PIN otorisasi Supervisor"
            />
            <small>
              Operator tidak dapat membatalkan Job tanpa persetujuan Supervisor.
            </small>
          </label>
        )}
        <label>
          Alasan Pembatalan
          <textarea
            required
            minLength={5}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Jelaskan alasan pembatalan untuk audit produksi"
          />
        </label>
        <div className="cancel-impact-note">
          <i className="bi bi-info-circle" />
          <span>
            Status menjadi Cancelled. Jika batch sudah selesai, pemakaian
            material akan dikembalikan melalui transaksi adjustment.
          </span>
        </div>
        <div className="cancel-modal-actions">
          <button type="button" className="btn btn-light" onClick={onClose}>
            Kembali
          </button>
          <button className="btn btn-danger" type="submit">
            <i className="bi bi-shield-lock" /> Konfirmasi Pembatalan
          </button>
        </div>
      </form>
    </div>
  );
}

function StartNoticeModal({
  setting,
  job,
  acknowledged,
  setAcknowledged,
  onContinue,
}: {
  setting: OperatorPopup;
  job?: Job;
  acknowledged: boolean;
  setAcknowledged: (value: boolean) => void;
  onContinue: () => void;
}) {
  const title = setting.title;
  const message = setting.message;
  return (
    <div className="modal-backdrop-custom">
      <section className="start-notice-modal" role="dialog" aria-modal="true">
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "2rem" }}>
          <img src="/movacorp-logo.png" alt="Movacorp Logo" style={{ height: "80px", objectFit: "contain" }} />
        </div>
        <p className="section-kicker">SEBELUM MEMULAI</p>
        <h2>{title}</h2>
        <p>{message}</p>
        {job && (
          <div className="notice-job" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
              <i className="bi bi-journal-check" />
              <span>
                <small>Job yang akan dijalankan</small>
                <strong>
                  {job.name} · Version {job.version}
                </strong>
              </span>
            </div>
            {job.product_code && (
              <strong style={{ fontSize: '24px', letterSpacing: '2px', color: 'var(--blue)' }}>
                {job.product_code}
              </strong>
            )}
          </div>
        )}
        {setting.requireAcknowledge && (
          <label className="notice-check">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />{" "}
            Saya sudah membaca dan memahami pengingat ini.
          </label>
        )}
        <button
          className="btn btn-primary btn-lg"
          disabled={setting.requireAcknowledge && !acknowledged}
          onClick={onContinue}
        >
          {job ? "Lanjut ke Halaman Proses" : "Masuk ke Aplikasi"}{" "}
          <i className="bi bi-arrow-right" />
        </button>
        <small className="timer-safety-note">
          <i className="bi bi-stopwatch" /> Timer belum berjalan. Tekan “Mulai
          Step & Timer” pada halaman berikutnya.
        </small>
      </section>
    </div>
  );
}

function ProcessAlertModal({
  alert,
  onClose,
  onConfirmNo,
}: {
  alert: ProcessAlert;
  onClose: () => void;
  onConfirmNo?: (note: string) => void;
}) {
  const [showNoForm, setShowNoForm] = useState(false);
  const [note, setNote] = useState("");

  const icon =
    alert.kind === "complete"
      ? "bi-check-circle-fill"
      : alert.kind === "paused"
        ? "bi-pause-circle-fill"
        : "bi-alarm-fill";

  if (showNoForm) {
    return (
      <div className="process-alert-layer">
        <section className="process-alert-card" role="alertdialog" aria-modal="true" style={{ width: '400px' }}>
          <h3 style={{ marginTop: 0 }}>Laporkan Kendala</h3>
          <p style={{ fontSize: '14px', marginBottom: '16px' }}>Silakan catat kendala atau penyimpangan yang terjadi (Wajib diisi):</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ketik catatan di sini..."
            style={{ width: '100%', height: '100px', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', marginBottom: '16px', resize: 'none' }}
          />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button className="btn btn-outline-secondary" onClick={() => setShowNoForm(false)}>Batal</button>
            <button className="btn btn-primary" style={{ background: 'var(--red)', borderColor: 'var(--red)' }} onClick={() => {
              if (note.trim() && onConfirmNo) {
                onConfirmNo(note);
                setShowNoForm(false);
              }
            }} disabled={!note.trim()}>Simpan & Pause</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="process-alert-layer">
      <section
        className={`process-alert-card alert-${alert.kind}`}
        role="alertdialog"
        aria-modal="true"
      >
        <span className="process-alert-icon">
          <i className={`bi ${icon}`} />
        </span>
        <p className="section-kicker">ALERT OPERATOR</p>
        <h2>{alert.title}</h2>
        <p>{alert.message}</p>
        
        {alert.kind === "expired" ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
            <button className="btn btn-primary btn-lg" style={{ background: 'var(--green)', borderColor: 'var(--green)', width: '100%' }} onClick={onClose}>
              <i className="bi bi-check-circle" /> YES, Lanjutkan Step
            </button>
            <button className="btn btn-outline-secondary btn-lg" style={{ width: '100%' }} onClick={() => setShowNoForm(true)}>
              <i className="bi bi-x-circle" /> NO, Ada Kendala
            </button>
          </div>
        ) : (
          <button className="btn btn-primary btn-lg" onClick={onClose}>
            <i className="bi bi-volume-up" /> Saya Mengerti
          </button>
        )}
      </section>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: string;
  title: string;
  text: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="empty-state">
      <span>
        <i className={`bi ${icon}`} />
      </span>
      <h1>{title}</h1>
      <p>{text}</p>
      <button className="btn btn-primary" onClick={onAction}>
        {action}
      </button>
    </div>
  );
}

export function PrintableLabel({
  batchNo,
  productCode,
  productName,
  packagingCode,
  fillingDate,
  expiredDate,
  storageLocation,
  output,
  unit,
  specialNotes,
}: {
  batchNo: string;
  productCode: string;
  productName: string;
  packagingCode: string;
  fillingDate: string;
  expiredDate: string;
  storageLocation: string;
  output: string | number;
  unit: string;
  specialNotes: string;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="print-label-container" style={{ display: 'none' }} aria-hidden="true">
      <div className="print-label-content" style={{ padding: '20px', border: '2px solid #000', width: '10cm', height: '15cm', boxSizing: 'border-box', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '10px' }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>AUTOMOVA</h2>
          <div style={{ fontSize: '12px' }}>PRODUCTION LABEL</div>
        </div>
        
        <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
          <tbody>
            <tr><td style={{ padding: '4px 0', fontWeight: 'bold', width: '40%' }}>Product Code</td><td style={{ padding: '4px 0' }}>: {productCode}</td></tr>
            <tr><td style={{ padding: '4px 0', fontWeight: 'bold' }}>Product Name</td><td style={{ padding: '4px 0' }}>: {productName}</td></tr>
            <tr><td style={{ padding: '4px 0', fontWeight: 'bold' }}>Batch No</td><td style={{ padding: '4px 0', fontSize: '18px', fontWeight: 'bold' }}>: {batchNo}</td></tr>
            <tr><td style={{ padding: '4px 0', fontWeight: 'bold' }}>Packaging</td><td style={{ padding: '4px 0' }}>: {packagingCode}</td></tr>
            <tr><td style={{ padding: '4px 0', fontWeight: 'bold' }}>Output</td><td style={{ padding: '4px 0' }}>: {output} {unit}</td></tr>
            <tr><td style={{ padding: '4px 0', fontWeight: 'bold' }}>Filling Date</td><td style={{ padding: '4px 0' }}>: {fillingDate}</td></tr>
            <tr><td style={{ padding: '4px 0', fontWeight: 'bold' }}>Expired Date</td><td style={{ padding: '4px 0' }}>: {expiredDate}</td></tr>
            <tr><td style={{ padding: '4px 0', fontWeight: 'bold' }}>Location</td><td style={{ padding: '4px 0' }}>: {storageLocation}</td></tr>
          </tbody>
        </table>
        
        {specialNotes && (
          <div style={{ marginTop: '10px', borderTop: '1px dashed #000', paddingTop: '10px', fontSize: '12px' }}>
            <strong>Notes:</strong> {specialNotes}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
