"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";

// A WYSIWYG editor that produces HTML, with an "HTML" tab for editing the
// code directly. The HTML is submitted in a hidden field named `name`; the API
// sanitizes it when it's saved.

const EMPTY_DOC = "<p></p>";
const normalize = (html: string) => (html.trim() === EMPTY_DOC ? "" : html);

type RichTextEditorProps = {
  name: string;
  initialHtml: string;
  placeholder?: string;
  ariaLabel: string;
};

// Tiptap generates random ids while rendering, so the editor streams in
// behind its own Suspense boundary instead of being prerendered.
export function RichTextEditor(props: RichTextEditorProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-[22rem] rounded-field border-2 border-line bg-surface px-4 py-3 text-sm text-subtle">
          Loading editor…
        </div>
      }
    >
      <RichTextEditorInner {...props} />
    </Suspense>
  );
}

function RichTextEditorInner({ name, initialHtml, placeholder = "Start writing…", ariaLabel }: RichTextEditorProps) {
  const [mode, setMode] = useState<"visual" | "html">("visual");
  const [html, setHtml] = useState(initialHtml);

  const editor = useEditor({
    // Render on the client only, so server and browser HTML match.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image,
      Youtube.configure({ nocookie: true, width: 640, height: 360 }),
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder }),
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        class: "dr-prose min-h-80 px-4 py-3 outline-none",
        "aria-label": ariaLabel,
        "aria-multiline": "true",
        role: "textbox",
      },
    },
    onUpdate: ({ editor }) => setHtml(normalize(editor.getHTML())),
  });

  function switchTo(next: "visual" | "html") {
    if (next === mode || !editor) return;
    if (next === "visual") editor.commands.setContent(html, { emitUpdate: false });
    setMode(next);
  }

  return (
    <div className="overflow-hidden rounded-field border-2 border-line bg-surface focus-within:border-droplet focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-droplet)_16%,transparent)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-divider bg-canvas px-2 py-1.5">
        {mode === "visual" && editor ? <Toolbar editor={editor} /> : <span className="px-2 text-xs font-semibold text-muted">Editing HTML</span>}
        <div role="tablist" aria-label="Editor mode" className="flex shrink-0 gap-0.5 rounded-full bg-divider p-0.5">
          {(["visual", "html"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => switchTo(m)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${mode === m ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"}`}
            >
              {m === "visual" ? "Visual" : "HTML"}
            </button>
          ))}
        </div>
      </div>

      {mode === "visual" ? (
        editor ? (
          <EditorContent editor={editor} />
        ) : (
          <div className="min-h-80 px-4 py-3 text-sm text-subtle">Loading editor…</div>
        )
      ) : (
        <textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          spellCheck={false}
          aria-label={`${ariaLabel} (HTML)`}
          className="block min-h-80 w-full resize-y border-0 px-4 py-3 font-mono text-[13px] leading-relaxed text-ink outline-none"
        />
      )}

      <input type="hidden" name={name} value={html} />
    </div>
  );
}

type PromptKind = "link" | "image" | "video";

const PROMPTS: Record<PromptKind, { label: string; placeholder: string; button: string }> = {
  link: { label: "Link address", placeholder: "https://example.com", button: "Apply link" },
  image: { label: "Image address", placeholder: "https://example.com/photo.jpg", button: "Insert image" },
  video: { label: "YouTube video address", placeholder: "https://www.youtube.com/watch?v=…", button: "Insert video" },
};

function Toolbar({ editor }: { editor: Editor }) {
  const [prompt, setPrompt] = useState<PromptKind | null>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-render the toolbar when the selection's formatting changes.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: e.isActive("heading", { level: 2 })
        ? "h2"
        : e.isActive("heading", { level: 3 })
          ? "h3"
          : e.isActive("heading", { level: 4 })
            ? "h4"
            : "p",
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      blockquote: e.isActive("blockquote"),
      link: e.isActive("link"),
      alignLeft: e.isActive({ textAlign: "left" }),
      alignCenter: e.isActive({ textAlign: "center" }),
      alignRight: e.isActive({ textAlign: "right" }),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  useEffect(() => {
    if (prompt) inputRef.current?.focus();
  }, [prompt]);

  function openPrompt(kind: PromptKind) {
    setError(null);
    setUrl(kind === "link" ? (editor.getAttributes("link").href ?? "") : "");
    setPrompt(kind);
  }

  function applyPrompt() {
    const value = url.trim();
    let chain = editor.chain().focus();
    // If an image or video is selected, insert after it instead of replacing it.
    const { selection } = editor.state;
    if (prompt !== "link" && "node" in selection && selection.node) chain = chain.setTextSelection(selection.to);
    if (prompt === "link") {
      if (!value) chain.extendMarkRange("link").unsetLink().run();
      else chain.extendMarkRange("link").setLink({ href: /^(https?:|mailto:|tel:)/i.test(value) ? value : `https://${value}` }).run();
    } else if (prompt === "image") {
      if (!/^https?:\/\//i.test(value)) return setError("Enter a full image address, starting with https://.");
      chain.setImage({ src: value }).run();
    } else if (prompt === "video") {
      if (!chain.setYoutubeVideo({ src: value }).run()) return setError("That doesn't look like a YouTube video link.");
    }
    setPrompt(null);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5">
        <select
          aria-label="Text style"
          value={state.block}
          onChange={(e) => {
            const v = e.target.value;
            const chain = editor.chain().focus();
            if (v === "p") chain.setParagraph().run();
            else chain.setHeading({ level: Number(v.slice(1)) as 2 | 3 | 4 }).run();
          }}
          className="mr-1 h-8 cursor-pointer rounded-lg border-2 border-line bg-surface px-2 text-xs font-semibold text-ink"
        >
          <option value="p">Paragraph</option>
          <option value="h2">Heading</option>
          <option value="h3">Subheading</option>
          <option value="h4">Small heading</option>
        </select>

        <ToolButton label="Bold" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
          <span className="font-black">B</span>
        </ToolButton>
        <ToolButton label="Italic" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <span className="font-serif italic">I</span>
        </ToolButton>
        <ToolButton label="Underline" active={state.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <span className="underline">U</span>
        </ToolButton>
        <ToolButton label="Strikethrough" active={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <span className="line-through">S</span>
        </ToolButton>

        <Divider />
        <ToolButton label="Bulleted list" active={state.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <Svg d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
        </ToolButton>
        <ToolButton label="Numbered list" active={state.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <Svg d="M10 6h10M10 12h10M10 18h10M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
        </ToolButton>
        <ToolButton label="Quote" active={state.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Svg d="M7 7h4v4c0 3-2 5-4 6M15 7h4v4c0 3-2 5-4 6" />
        </ToolButton>

        <Divider />
        <ToolButton label="Align left" active={state.alignLeft} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
          <Svg d="M4 6h16M4 12h10M4 18h14" />
        </ToolButton>
        <ToolButton label="Align center" active={state.alignCenter} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
          <Svg d="M4 6h16M7 12h10M5 18h14" />
        </ToolButton>
        <ToolButton label="Align right" active={state.alignRight} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
          <Svg d="M4 6h16M10 12h10M6 18h14" />
        </ToolButton>

        <Divider />
        <ToolButton label="Link" active={state.link || prompt === "link"} onClick={() => openPrompt("link")}>
          <Svg d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
        </ToolButton>
        <ToolButton label="Image" active={prompt === "image"} onClick={() => openPrompt("image")}>
          <Svg d="M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01" />
        </ToolButton>
        <ToolButton label="YouTube video" active={prompt === "video"} onClick={() => openPrompt("video")}>
          <Svg d="M3 7a3 3 0 013-3h12a3 3 0 013 3v10a3 3 0 01-3 3H6a3 3 0 01-3-3zM10 9l5 3-5 3z" />
        </ToolButton>
        <ToolButton label="Divider line" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Svg d="M4 12h16" />
        </ToolButton>

        <Divider />
        <ToolButton label="Undo" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}>
          <Svg d="M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3" />
        </ToolButton>
        <ToolButton label="Redo" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}>
          <Svg d="M15 14l5-5-5-5M20 9H9a5 5 0 000 10h3" />
        </ToolButton>
      </div>

      {prompt && (
        <div className="flex flex-wrap items-center gap-2 pb-0.5">
          <label htmlFor="rte-url" className="sr-only">{PROMPTS[prompt].label}</label>
          <input
            ref={inputRef}
            id="rte-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              // Enter applies here instead of submitting the whole form.
              if (e.key === "Enter") {
                e.preventDefault();
                applyPrompt();
              } else if (e.key === "Escape") {
                setPrompt(null);
              }
            }}
            placeholder={PROMPTS[prompt].placeholder}
            className="h-8 min-w-0 flex-1 rounded-lg border-2 border-line bg-surface px-2.5 text-sm outline-none focus:border-droplet"
          />
          <button type="button" onClick={applyPrompt} className="h-8 rounded-full bg-droplet px-3 text-xs font-bold text-white">
            {PROMPTS[prompt].button}
          </button>
          {prompt === "link" && state.link && (
            <button
              type="button"
              onClick={() => {
                editor.chain().focus().extendMarkRange("link").unsetLink().run();
                setPrompt(null);
              }}
              className="h-8 rounded-full px-2.5 text-xs font-bold text-[#b8321f] hover:bg-coral-tint"
            >
              Remove link
            </button>
          )}
          <button type="button" onClick={() => setPrompt(null)} className="h-8 rounded-full px-2.5 text-xs font-bold text-muted hover:bg-divider">
            Cancel
          </button>
          {error && <p role="alert" className="w-full text-xs font-semibold text-[#b8321f]">{error}</p>}
        </div>
      )}
    </div>
  );
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      // Keep the editor's selection when clicking the toolbar.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex size-8 items-center justify-center rounded-lg text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
        active ? "bg-droplet-tint text-[#0369a1]" : "text-ink-soft hover:bg-divider hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-0.5 rounded bg-line" />;
}

function Svg({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
