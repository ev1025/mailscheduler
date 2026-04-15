"use client";

import { useState } from "react";
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Pencil,
  Pin,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { KnowledgeFolder, KnowledgeItem } from "@/types";
import PromptDialog from "@/components/ui/prompt-dialog";
import ConfirmDialog from "@/components/ui/confirm-dialog";

interface TreeNode {
  type: "folder" | "item";
  id: string;
  parentId: string | null;
  data: KnowledgeFolder | KnowledgeItem;
  children: TreeNode[];
}

function buildTree(
  folders: KnowledgeFolder[],
  items: KnowledgeItem[]
): TreeNode[] {
  const folderMap = new Map<string, TreeNode>();
  folders.forEach((f) => {
    folderMap.set(f.id, {
      type: "folder",
      id: f.id,
      parentId: f.parent_id,
      data: f,
      children: [],
    });
  });

  const roots: TreeNode[] = [];
  folderMap.forEach((node) => {
    if (node.parentId && folderMap.has(node.parentId)) {
      folderMap.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // 아이템을 폴더 아래에 배치
  items.forEach((i) => {
    const node: TreeNode = {
      type: "item",
      id: i.id,
      parentId: i.folder_id,
      data: i,
      children: [],
    };
    if (i.folder_id && folderMap.has(i.folder_id)) {
      folderMap.get(i.folder_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // 정렬: 폴더 먼저, 그 안에 핀 먼저
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      if (a.type === "folder") {
        return (
          ((a.data as KnowledgeFolder).sort_order ?? 0) -
          ((b.data as KnowledgeFolder).sort_order ?? 0)
        );
      }
      const ai = a.data as KnowledgeItem;
      const bi = b.data as KnowledgeItem;
      if (ai.pinned !== bi.pinned) return ai.pinned ? -1 : 1;
      return (
        new Date(bi.updated_at).getTime() - new Date(ai.updated_at).getTime()
      );
    });
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);
  return roots;
}

interface Props {
  folders: KnowledgeFolder[];
  items: KnowledgeItem[];
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
  onAddFolder: (parentId: string | null) => void;
  onAddItem: (folderId: string | null) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onMoveFolder: (id: string, newParentId: string | null) => void;
  onMoveItem: (id: string, newFolderId: string | null) => void;
}

function DraggableNode({
  node,
  children,
}: {
  node: TreeNode;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: node.type + ":" + node.id,
    data: { type: node.type, id: node.id },
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={isDragging ? "opacity-40" : ""}
    >
      {children}
    </div>
  );
}

function FolderDropZone({
  folderId,
  children,
}: {
  folderId: string | null;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "drop:" + (folderId || "root"),
    data: { folderId },
  });
  return (
    <div
      ref={setNodeRef}
      className={isOver ? "bg-primary/10 rounded-md" : ""}
    >
      {children}
    </div>
  );
}

function NodeRow({
  node,
  depth,
  expanded,
  onToggleExpand,
  selectedItemId,
  onSelectItem,
  onAddFolder,
  onAddItem,
  onRequestRenameFolder,
  onRequestDeleteFolder,
  onRequestDeleteItem,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
  onAddFolder: (parentId: string | null) => void;
  onAddItem: (folderId: string | null) => void;
  onRequestRenameFolder: (id: string, currentName: string) => void;
  onRequestDeleteFolder: (id: string, name: string) => void;
  onRequestDeleteItem: (id: string, title: string) => void;
}) {
  const isExpanded = expanded.has(node.id);
  const isSelected = node.type === "item" && selectedItemId === node.id;

  if (node.type === "folder") {
    const f = node.data as KnowledgeFolder;
    const content = (
      <div
        className="group/row flex items-center gap-1 py-1 pr-2 text-xs cursor-pointer hover:bg-accent rounded-md"
        style={{ paddingLeft: depth * 12 + 4 }}
        onClick={() => onToggleExpand(node.id)}
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        {isExpanded ? (
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="flex-1 truncate font-medium">{f.name}</span>
        <button
          type="button"
          className="opacity-0 group-hover/row:opacity-100 p-0.5 text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onAddItem(node.id);
          }}
          title="이 폴더에 노트 추가"
        >
          <Plus className="h-3 w-3" />
        </button>
        <button
          type="button"
          className="opacity-0 group-hover/row:opacity-100 p-0.5 text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onAddFolder(node.id);
          }}
          title="하위 폴더 추가"
        >
          <Folder className="h-3 w-3" />
        </button>
        <button
          type="button"
          className="opacity-0 group-hover/row:opacity-100 p-0.5 text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onRequestRenameFolder(node.id, f.name);
          }}
          title="이름 변경"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          type="button"
          className="opacity-0 group-hover/row:opacity-100 p-0.5 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onRequestDeleteFolder(node.id, f.name);
          }}
          title="삭제"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    );
    return (
      <FolderDropZone folderId={node.id}>
        <DraggableNode node={node}>{content}</DraggableNode>
        {isExpanded &&
          node.children.map((child) => (
            <NodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              selectedItemId={selectedItemId}
              onSelectItem={onSelectItem}
              onAddFolder={onAddFolder}
              onAddItem={onAddItem}
              onRequestRenameFolder={onRequestRenameFolder}
              onRequestDeleteFolder={onRequestDeleteFolder}
              onRequestDeleteItem={onRequestDeleteItem}
            />
          ))}
      </FolderDropZone>
    );
  }

  // item
  const i = node.data as KnowledgeItem;
  return (
    <DraggableNode node={node}>
      <div
        onClick={() => onSelectItem(node.id)}
        className={`group/row flex items-center gap-1 py-1 pr-2 text-xs cursor-pointer rounded-md ${
          isSelected ? "bg-accent font-medium" : "hover:bg-accent/50"
        }`}
        style={{ paddingLeft: depth * 12 + 20 }}
      >
        {i.pinned && <Pin className="h-2.5 w-2.5 text-primary shrink-0" />}
        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate">{i.title}</span>
        <button
          type="button"
          className="opacity-0 group-hover/row:opacity-100 p-0.5 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onRequestDeleteItem(node.id, i.title);
          }}
          title="삭제"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </DraggableNode>
  );
}

export default function KnowledgeTree({
  folders,
  items,
  selectedItemId,
  onSelectItem,
  onAddFolder,
  onAddItem,
  onRenameFolder,
  onDeleteFolder,
  onDeleteItem,
  onMoveFolder,
  onMoveItem,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState<{ id: string; title: string } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const tree = buildTree(folders, items);

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const activeData = active.data.current as
      | { type: "folder" | "item"; id: string }
      | undefined;
    const overData = over.data.current as { folderId: string | null } | undefined;
    if (!activeData || !overData) return;

    if (activeData.type === "folder") {
      if (activeData.id === overData.folderId) return;
      onMoveFolder(activeData.id, overData.folderId);
    } else {
      onMoveItem(activeData.id, overData.folderId);
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-0.5">
        <FolderDropZone folderId={null}>
          <div className="py-1">
            {tree.map((node) => (
              <NodeRow
                key={node.id}
                node={node}
                depth={0}
                expanded={expanded}
                onToggleExpand={toggleExpand}
                selectedItemId={selectedItemId}
                onSelectItem={onSelectItem}
                onAddFolder={onAddFolder}
                onAddItem={onAddItem}
                onRequestRenameFolder={(id, name) => setRenameTarget({ id, name })}
                onRequestDeleteFolder={(id, name) => setDeleteFolderTarget({ id, name })}
                onRequestDeleteItem={(id, title) => setDeleteItemTarget({ id, title })}
              />
            ))}
          </div>
        </FolderDropZone>
      </div>

      <PromptDialog
        open={!!renameTarget}
        onOpenChange={(o) => { if (!o) setRenameTarget(null); }}
        title="폴더 이름 변경"
        defaultValue={renameTarget?.name || ""}
        confirmLabel="변경"
        onConfirm={async (name) => {
          if (renameTarget) onRenameFolder(renameTarget.id, name);
          setRenameTarget(null);
        }}
      />

      <ConfirmDialog
        open={!!deleteFolderTarget}
        onOpenChange={(o) => { if (!o) setDeleteFolderTarget(null); }}
        title="폴더 삭제"
        description={
          <>
            <strong>{deleteFolderTarget?.name}</strong> 폴더를 삭제할까요?
            <br />
            내부 내용도 함께 이동/삭제됩니다.
          </>
        }
        confirmLabel="삭제"
        destructive
        onConfirm={async () => {
          if (deleteFolderTarget) onDeleteFolder(deleteFolderTarget.id);
          setDeleteFolderTarget(null);
        }}
      />

      <ConfirmDialog
        open={!!deleteItemTarget}
        onOpenChange={(o) => { if (!o) setDeleteItemTarget(null); }}
        title="노트 삭제"
        description={`"${deleteItemTarget?.title}" 노트를 삭제할까요?`}
        confirmLabel="삭제"
        destructive
        onConfirm={async () => {
          if (deleteItemTarget) onDeleteItem(deleteItemTarget.id);
          setDeleteItemTarget(null);
        }}
      />
    </DndContext>
  );
}
