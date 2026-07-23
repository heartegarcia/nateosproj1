"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FolderPlus, Paperclip, Trash2 } from "lucide-react";

const NEW_FOLDER = "__new__";

interface AttachmentLike {
  id: string;
  folder: string;
  file_name: string;
  file_size: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Folder-based attachments UI, shared by tasks and project gallery entries.
 * Folders are real, persisted containers (created via fetchFoldersFn/createFolderFn)
 * so they show up immediately — before any file is uploaded into them — rather than
 * existing only implicitly once an attachment happens to use that name.
 */
export function AttachmentsSection<T extends AttachmentLike>({
  ownerId,
  fetchFn,
  uploadFn,
  deleteFn,
  downloadUrl,
  fetchFoldersFn,
  createFolderFn,
  onAttached,
}: {
  ownerId: string;
  fetchFn: (ownerId: string) => Promise<{ attachments: T[] }>;
  uploadFn: (ownerId: string, folder: string, file: File) => Promise<{ attachment: T }>;
  deleteFn: (ownerId: string, attachmentId: string) => Promise<{ ok: true }>;
  downloadUrl: (ownerId: string, attachmentId: string) => string;
  fetchFoldersFn: (ownerId: string) => Promise<{ folders: string[] }>;
  createFolderFn: (ownerId: string, name: string) => Promise<{ folders: string[] }>;
  /** Called after a successful upload — lets the owner (e.g. a task drawer) offer a
   * "mark complete?" nudge instead of silently auto-completing on every attachment. */
  onAttached?: () => void;
}) {
  const [attachments, setAttachments] = useState<T[]>([]);
  const [folders, setFolders] = useState<string[]>(["General"]);
  const [loading, setLoading] = useState(true);
  const [folderChoice, setFolderChoice] = useState("General");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolderSaving, setCreatingFolderSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refreshAttachments() {
    const { attachments } = await fetchFn(ownerId);
    setAttachments(attachments);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [a, f] = await Promise.all([fetchFn(ownerId), fetchFoldersFn(ownerId)]);
      if (!cancelled) {
        setAttachments(a.attachments);
        setFolders(f.folders);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  const grouped = folders.map((folder) => ({
    folder,
    files: attachments.filter((a) => a.folder === folder),
  }));

  async function handleFileSelected(file: File) {
    setUploading(true);
    try {
      await uploadFn(ownerId, folderChoice, file);
      await refreshAttachments();
      onAttached?.();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(attachmentId: string) {
    await deleteFn(ownerId, attachmentId);
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    setCreatingFolderSaving(true);
    try {
      const { folders } = await createFolderFn(ownerId, newFolderName.trim());
      setFolders(folders);
      setFolderChoice(newFolderName.trim());
      setCreatingFolder(false);
      setNewFolderName("");
    } finally {
      setCreatingFolderSaving(false);
    }
  }

  return (
    <div>
      <span className="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
        <Paperclip size={13} /> Attachments
      </span>

      {loading ? (
        <p className="text-xs text-zinc-400">Loading…</p>
      ) : (
        <div className="mb-3 space-y-3">
          {grouped.map((g) => (
            <div key={g.folder}>
              <p className="mb-1 text-xs font-semibold text-zinc-400">{g.folder}</p>
              {g.files.length === 0 ? (
                <p className="text-xs text-zinc-300">Empty folder — no files yet.</p>
              ) : (
                <ul className="space-y-1">
                  {g.files.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-1.5"
                    >
                      <span className="min-w-0 truncate text-xs text-zinc-700" title={a.file_name}>
                        {a.file_name}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-[11px] text-zinc-400">{formatSize(a.file_size)}</span>
                        <a
                          href={downloadUrl(ownerId, a.id)}
                          className="text-zinc-400 hover:text-zinc-700"
                          title="Download"
                        >
                          <Download size={13} />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDelete(a.id)}
                          className="text-zinc-400 hover:text-red-500"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {creatingFolder ? (
          <span className="flex items-center gap-1">
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreateFolder();
                }
              }}
              placeholder="Folder name"
              className="w-28 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-400"
            />
            <button
              type="button"
              onClick={handleCreateFolder}
              disabled={creatingFolderSaving || !newFolderName.trim()}
              className="rounded-lg bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white disabled:opacity-40"
            >
              {creatingFolderSaving ? "…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreatingFolder(false);
                setNewFolderName("");
              }}
              className="text-zinc-400 hover:text-zinc-600"
            >
              ✕
            </button>
          </span>
        ) : (
          <select
            value={folderChoice}
            onChange={(e) => {
              if (e.target.value === NEW_FOLDER) setCreatingFolder(true);
              else setFolderChoice(e.target.value);
            }}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700"
          >
            {folders.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
            <option value={NEW_FOLDER}>+ New folder…</option>
          </select>
        )}

        <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:border-zinc-400 hover:text-zinc-700">
          <FolderPlus size={13} />
          {uploading ? "Uploading…" : "Upload file"}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelected(file);
            }}
          />
        </label>
      </div>
    </div>
  );
}
