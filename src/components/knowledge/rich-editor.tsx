"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import GlobalDragHandle from "tiptap-extension-global-drag-handle";
import AutoJoiner from "tiptap-extension-auto-joiner";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Image as ImageIcon,
  Table as TableIcon,
  Link as LinkIcon,
  Undo,
  Redo,
  Minus,
  MoreHorizontal,
  Type,
} from "lucide-react";
import { useRef, useState } from "react";
import { uploadToStorage } from "@/lib/storage";
import { toast } from "sonner";

interface Props {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

function ToolbarButton({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded transition-colors ${
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />;
}

type AlignMode = "left" | "center" | "right" | "justify";
const ALIGN_CYCLE: AlignMode[] = ["left", "center", "right", "justify"];
const ALIGN_ICON: Record<AlignMode, React.ComponentType<{ className?: string }>> = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
  justify: AlignJustify,
};
const ALIGN_LABEL: Record<AlignMode, string> = {
  left: "왼쪽 정렬",
  center: "가운데 정렬",
  right: "오른쪽 정렬",
  justify: "양쪽 정렬",
};

function MoreItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 rounded-lg p-3 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        {icon}
      </span>
      {label}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const imageRef = useRef<HTMLInputElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [textPanelOpen, setTextPanelOpen] = useState(false);

  const currentAlign: AlignMode =
    (ALIGN_CYCLE.find((a) => editor.isActive({ textAlign: a })) as AlignMode) || "left";
  const cycleAlign = () => {
    const idx = ALIGN_CYCLE.indexOf(currentAlign);
    const next = ALIGN_CYCLE[(idx + 1) % ALIGN_CYCLE.length];
    editor.chain().focus().setTextAlign(next).run();
  };
  const AlignIcon = ALIGN_ICON[currentAlign];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15_000_000) {
      toast.error("15MB 이하 이미지만 삽입할 수 있어요");
      return;
    }
    // 큰 이미지는 canvas로 1600px 내로 축소 + JPEG 0.85 품질로 압축,
    // 이후 Supabase Storage에 업로드 후 public URL을 삽입 (base64 DB 폭증 방지).
    const img = document.createElement("img");
    img.onload = async () => {
      try {
        const MAX = 1600;
        let w = img.width;
        let h = img.height;
        if (w > MAX || h > MAX) {
          if (w >= h) {
            h = Math.round((h * MAX) / w);
            w = MAX;
          } else {
            w = Math.round((w * MAX) / h);
            h = MAX;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.85)
        );
        if (!blob) {
          toast.error("이미지 변환 실패");
          return;
        }
        const uploadFile = new File([blob], `note-${Date.now()}.jpg`, { type: "image/jpeg" });
        const { url, error } = await uploadToStorage("knowledge-images", uploadFile, "jpg");
        if (error || !url) {
          toast.error(error || "이미지 업로드 실패");
          return;
        }
        editor.chain().focus().setImage({ src: url }).run();
      } finally {
        URL.revokeObjectURL(img.src);
      }
    };
    img.src = URL.createObjectURL(file);
    e.target.value = "";
  };

  const addLink = () => {
    const prev = (editor.getAttributes("link").href as string | undefined) || "";
    const url = window.prompt("링크 URL (비우면 제거):", prev);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const sel = editor.state.selection;
    const hasSelection = sel.from !== sel.to;
    if (hasSelection) {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    } else {
      // 선택 영역 없으면 URL 자체를 링크 텍스트로 삽입
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: url,
          marks: [{ type: "link", attrs: { href: url } }],
        })
        .run();
    }
  };

  const addTable = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  };

  return (
    <div className="flex flex-col border-b bg-background sticky top-0 z-10">
      {/* 메인 툴바 — 1줄, 네이버 블로그 스타일 */}
      <div className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto scrollbar-none whitespace-nowrap">
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          title="실행 취소"
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          title="다시 실행"
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton onClick={() => imageRef.current?.click()} title="이미지">
          <ImageIcon className="h-5 w-5" />
        </ToolbarButton>
        <input
          ref={imageRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />

        <ToolbarButton
          active={textPanelOpen}
          onClick={() => setTextPanelOpen((o) => !o)}
          title="글자 서식"
        >
          <Type className="h-5 w-5" />
        </ToolbarButton>

        {/* 정렬 — 단일 버튼 사이클 */}
        <ToolbarButton onClick={cycleAlign} title={ALIGN_LABEL[currentAlign]}>
          <AlignIcon className="h-5 w-5" />
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="글머리 기호"
        >
          <List className="h-5 w-5" />
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="인용구"
        >
          <Quote className="h-5 w-5" />
        </ToolbarButton>

        <ToolbarButton
          active={moreOpen}
          onClick={() => setMoreOpen((o) => !o)}
          title="더보기"
        >
          <MoreHorizontal className="h-5 w-5" />
        </ToolbarButton>
      </div>

      {/* 글자 서식 확장 패널 (T 버튼 눌렀을 때만) */}
      {textPanelOpen && (
        <div className="flex items-center gap-1 border-t px-2 py-1.5 overflow-x-auto scrollbar-none whitespace-nowrap bg-muted/20">
          <ToolbarButton
            active={editor.isActive("heading", { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            title="제목 1"
          >
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("heading", { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="제목 2"
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("heading", { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            title="제목 3"
          >
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarDivider />
          <ToolbarButton
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="굵게"
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="기울임"
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="밑줄"
          >
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="취소선"
          >
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          <input
            type="color"
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            className="h-8 w-8 cursor-pointer rounded border-none bg-transparent"
            title="글자 색상"
          />
        </div>
      )}

      {/* 더보기 패널 — 네이버 블로그 스타일 4열 그리드 */}
      {moreOpen && (
        <div className="border-t bg-muted/30 p-4">
          <div className="grid grid-cols-4 gap-2">
            <MoreItem
              icon={<LinkIcon className="h-5 w-5" />}
              label="링크"
              onClick={() => {
                addLink();
                setMoreOpen(false);
              }}
            />
            <MoreItem
              icon={<TableIcon className="h-5 w-5" />}
              label="표"
              onClick={() => {
                addTable();
                setMoreOpen(false);
              }}
            />
            <MoreItem
              icon={<ListOrdered className="h-5 w-5" />}
              label="번호 목록"
              onClick={() => {
                editor.chain().focus().toggleOrderedList().run();
                setMoreOpen(false);
              }}
            />
            <MoreItem
              icon={<Code className="h-5 w-5" />}
              label="코드 블록"
              onClick={() => {
                editor.chain().focus().toggleCodeBlock().run();
                setMoreOpen(false);
              }}
            />
            <MoreItem
              icon={<Minus className="h-5 w-5" />}
              label="구분선"
              onClick={() => {
                editor.chain().focus().setHorizontalRule().run();
                setMoreOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function RichEditor({ content, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image.configure({ inline: false, allowBase64: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({
        placeholder: placeholder || "내용을 입력하세요...",
      }),
      GlobalDragHandle.configure({
        dragHandleWidth: 20,
        scrollTreshold: 100,
      }),
      AutoJoiner,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tiptap-editor",
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="flex flex-col h-full">
      <Toolbar editor={editor} />
      <div
        className="flex-1 overflow-y-auto p-4 cursor-text"
        onClick={() => editor.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
