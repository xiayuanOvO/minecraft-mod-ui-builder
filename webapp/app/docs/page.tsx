import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Documentation — Minecraft Screen Designer",
  description: "Complete guide to designing Minecraft mod GUI screens with bindings, actions, scrollbars, and more.",
};

// ─── primitives ──────────────────────────────────────────────────────────────

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 px-1.5 py-0.5 rounded text-[0.8em] font-mono">
      {children}
    </code>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-zinc-950 text-zinc-100 rounded-xl px-5 py-4 text-xs font-mono overflow-x-auto leading-relaxed">
      {children}
    </pre>
  );
}

function Callout({ kind = "note", children }: { kind?: "note" | "tip" | "warn"; children: React.ReactNode }) {
  const styles = {
    note: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200",
    tip: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200",
    warn: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200",
  };
  const labels = { note: "Note", tip: "Tip", warn: "Warning" };
  return (
    <div className={`border rounded-lg px-4 py-3 text-sm ${styles[kind]}`}>
      <span className="font-semibold mr-1.5">{labels[kind]}:</span>
      {children}
    </div>
  );
}

function Screenshot({
  src, alt, caption,
}: {
  src: string; alt: string; caption?: string;
}) {
  return (
    <figure className="my-2">
      <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-lg">
        <img src={src} alt={alt} className="w-full block" />
      </div>
      {caption && (
        <figcaption className="text-center text-xs text-muted-foreground mt-2">{caption}</figcaption>
      )}
    </figure>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-none w-7 h-7 rounded-full bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 text-sm font-bold flex items-center justify-center mt-0.5">
        {n}
      </div>
      <div className="flex-1 min-w-0 pb-6">
        <p className="font-semibold mb-1">{title}</p>
        <div className="text-sm text-muted-foreground space-y-2">{children}</div>
      </div>
    </div>
  );
}

function SectionHeading({ id, label, title, sub }: { id: string; label: string; title: string; sub?: string }) {
  return (
    <div id={id} className="scroll-mt-20 mb-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
      <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
      {sub && <p className="mt-2 text-muted-foreground max-w-2xl">{sub}</p>}
    </div>
  );
}

function Divider() {
  return <hr className="border-zinc-200 dark:border-zinc-800 my-16" />;
}

// ─── nav items ────────────────────────────────────────────────────────────────

const NAV = [
  { id: "overview", label: "Overview" },
  { id: "getting-started", label: "Getting started" },
  { id: "canvas", label: "Canvas & editing" },
  { id: "widgets", label: "Widget types" },
  { id: "bindings", label: "Data bindings" },
  { id: "actions", label: "Actions" },
  { id: "scrollbars", label: "Scrollbars" },
  { id: "inventory", label: "Inventory areas" },
  { id: "try-mode", label: "Try mode" },
  { id: "export", label: "Export / Import" },
  { id: "shortcuts", label: "Keyboard shortcuts" },
  { id: "json", label: "JSON reference" },
];

// ─── page ─────────────────────────────────────────────────────────────────────

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* sticky header */}
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to editor
          </Link>
          <span className="text-muted-foreground/40 select-none">/</span>
          <span className="text-sm font-semibold">Docs</span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-12 flex gap-12">

        {/* sidebar */}
        <aside className="hidden lg:block w-48 shrink-0">
          <nav className="sticky top-24">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">On this page</p>
            <ul className="space-y-0.5">
              {NAV.map((n) => (
                <li key={n.id}>
                  <a
                    href={`#${n.id}`}
                    className="block px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* main */}
        <main className="flex-1 min-w-0 max-w-3xl space-y-0">

          {/* ── HERO ──────────────────────────────────────────────────── */}
          <div id="overview" className="scroll-mt-20 mb-14">
            <h1 className="text-4xl font-bold tracking-tight mb-3">Minecraft Screen Designer</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mb-8">
              A pixel-accurate visual editor for Minecraft mod GUIs. Design screens on a canvas,
              bind them to your mod&apos;s runtime data, and export a single JSON file consumed by the
              NeoForge runtime library.
            </p>

            {/* quick-nav cards */}
            <div className="grid sm:grid-cols-2 gap-3 mb-10">
              {[
                { href: "#getting-started", title: "Getting started", desc: "Create your first project in under a minute" },
                { href: "#bindings", title: "Data bindings", desc: "Drive widget props from your mod's runtime data" },
                { href: "#actions", title: "Actions", desc: "React to player interactions in Java" },
                { href: "#json", title: "JSON reference", desc: "Complete ScreenSpec format with annotations" },
              ].map((c) => (
                <a
                  key={c.href}
                  href={c.href}
                  className="group flex items-start gap-3 rounded-xl border p-4 hover:border-foreground/40 hover:bg-muted/50 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm group-hover:text-foreground">{c.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
                </a>
              ))}
            </div>

            <Screenshot
              src="/docs/editor-overview.png"
              alt="Minecraft Screen Designer editor"
              caption="The editor: layers panel (left), canvas (center), property panel (right)"
            />
          </div>

          <Divider />

          {/* ── GETTING STARTED ───────────────────────────────────────── */}
          <SectionHeading
            id="getting-started"
            label="01 — Getting started"
            title="Create your first screen"
            sub="From zero to a working screen in a few steps."
          />

          <div className="border rounded-xl divide-y overflow-hidden mb-8">
            <Step n={1} title="Open the editor">
              <p>On first visit you see the <strong>Welcome screen</strong>. Click <strong>New Project</strong>.</p>
            </Step>
            <Step n={2} title="Fill in project details">
              <p>
                Enter your <strong>Mod ID</strong> (e.g. <Code>my_mod</Code>) — this qualifies all
                binding paths and action names in Java. Set an optional <strong>Screen ID</strong>
                (defaults to <Code>main</Code>); it becomes the exported filename.
              </p>
            </Step>
            <Step n={3} title="Add widgets">
              <p>
                Click the <strong>+</strong> in the Layers panel to add a widget. Start with a
                <Code>panel</Code> as your background, then layer labels, buttons, and inputs on top.
              </p>
            </Step>
            <Step n={4} title="Export">
              <p>
                Click <strong>↓</strong> in the toolbar (or use the download icon) to save
                <Code>{"{screenId}.json"}</Code>. Drop it into your mod&apos;s resources.
              </p>
            </Step>
          </div>

          <h3 className="text-base font-semibold mb-3">Toolbar at a glance</h3>
          <Screenshot
            src="/docs/editor-overview.png"
            alt="Editor toolbar"
            caption="Toolbar: sidebar toggle, screen size, grid, undo/redo, zoom, Try mode, import/export, bindings, settings, docs"
          />
          <div className="mt-4 grid sm:grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
            {[
              ["☰ Sidebar", "Toggle Layers & Screens panel"],
              ["W / H", "Screen size in MC pixels"],
              ["Grid / Snap", "Dot-grid overlay + snapping granularity"],
              ["↩ ↪", "Undo / Redo (up to 100 steps)"],
              ["− N× +", "Zoom controls"],
              ["▶ Try", "Enter interactive preview mode"],
              ["↑ ↓", "Import / Export JSON"],
              ["Image icon", "Export active screen as PNG"],
              ["Network icon", "Data Schema (Bindings & Actions)"],
              ["⚙ gear", "Settings (mod ID, theme, textures)"],
              ["? book", "This documentation"],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="font-mono text-xs bg-muted rounded px-1.5 py-0.5 shrink-0 self-start">{k}</span>
                <span className="text-muted-foreground text-xs">{v}</span>
              </div>
            ))}
          </div>

          <Divider />

          {/* ── CANVAS ────────────────────────────────────────────────── */}
          <SectionHeading
            id="canvas"
            label="02 — Canvas"
            title="Editing on the canvas"
            sub="Drag, resize, and organise widgets with precision."
          />

          <div className="grid sm:grid-cols-2 gap-6 mb-8">
            {[
              { title: "Select", body: "Click a widget to select it. Click empty space or press Escape to clear the selection. ⌘/Ctrl-click or Shift-click toggles a widget in the current multi-selection." },
              { title: "Move & resize", body: "Drag to move, drag handles to resize. Both snap to the Snap setting. Arrow keys nudge 1 px; Shift + Arrow nudges by snap size." },
              { title: "Copy / Paste", body: "⌘C to copy, ⌘V to paste (+8 px offset). ⌘D duplicates the selected widget in place with the same offset." },
              { title: "Undo / Redo", body: "Full history across all screens in the project, up to 100 entries. ⌘Z / ⌘⇧Z. History is shared — undoing on screen B can restore a change made on screen A." },
            ].map((c) => (
              <div key={c.title} className="rounded-xl border p-4">
                <p className="font-semibold text-sm mb-1">{c.title}</p>
                <p className="text-sm text-muted-foreground">{c.body}</p>
              </div>
            ))}
          </div>

          <h3 className="text-base font-semibold mb-3">Layers panel & reordering</h3>
          <div className="flex flex-col sm:flex-row gap-6 mb-6">
            <div className="sm:w-64 shrink-0">
              <Screenshot src="/docs/layers-panel.png" alt="Layers panel" />
            </div>
            <div className="flex-1 text-sm space-y-3 text-muted-foreground">
              <p>The <strong className="text-foreground">Layers panel</strong> (left sidebar) shows all widgets as a tree. Container widgets can be collapsed.</p>
              <ul className="space-y-2">
                <li><strong className="text-foreground">Click</strong> a row to select that widget.</li>
                <li><strong className="text-foreground">⌘/Ctrl-click</strong> rows to add or remove individual widgets from the selection.</li>
                <li><strong className="text-foreground">Shift-click</strong> a sibling row to select the full range from the anchor.</li>
                <li><strong className="text-foreground">Drag</strong> rows to reorder. Drop on the middle of a container to reparent the widget inside it.</li>
                <li><strong className="text-foreground">Hover</strong> a container row for the <Code>+</Code> button to add a child widget directly.</li>
                <li><strong className="text-foreground">Hover</strong> any row for the trash icon to delete.</li>
              </ul>
            </div>
          </div>

          <Callout kind="tip">
            Dragging any selected widget moves the whole selection. Arrow keys nudge every selected
            widget, and Delete removes the selection. The properties panel edits the primary widget.
          </Callout>

          <Divider />

          {/* ── WIDGETS ───────────────────────────────────────────────── */}
          <SectionHeading
            id="widgets"
            label="03 — Widgets"
            title="Widget types"
            sub="Twelve types covering every Minecraft GUI primitive."
          />

          {/* Containers */}
          <h3 className="text-base font-semibold mb-3 mt-2">Containers</h3>
          <p className="text-sm text-muted-foreground mb-4">Container widgets hold children. Child coordinates are relative to the container&apos;s top-left corner.</p>
          <div className="rounded-xl border overflow-hidden mb-8">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2.5">Type</th>
                  <th className="text-left px-4 py-2.5">Default size</th>
                  <th className="text-left px-4 py-2.5">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  ["group", "auto", "Invisible grouping container. Auto-sizes to wrap children. Shown as a dashed blue outline in edit mode. Cannot be manually resized."],
                  ["panel", "176 × 166", "Draws the vanilla MC stone-bevel background using a 9-slice texture. Prop: style → default (light grey) / dark (translucent black) / transparent."],
                  ["scroll", "160 × 120", "Clipping container — children outside bounds are hidden. In Try Mode the area scrolls with the mouse wheel."],
                ].map(([type, size, desc]) => (
                  <tr key={type}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{type}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{size}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Interactive */}
          <h3 className="text-base font-semibold mb-3">Interactive widgets</h3>
          <div className="rounded-xl border overflow-hidden mb-8">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2.5">Type</th>
                  <th className="text-left px-4 py-2.5">Default size</th>
                  <th className="text-left px-4 py-2.5">Key props</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  ["button", "72 × 20", "text, icon. Renders normal/hover/pressed MC button textures. Fires its action on click."],
                  ["toggle_button", "72 × 20", "text, icon, group — widgets sharing the same non-empty group act as a radio group. Empty group = independent on/off. Shows green text when active."],
                  ["input", "120 × 20", "hint_text, max_length (default 32). Renders an MC edit box. Blinking cursor in Try Mode."],
                  ["slider", "150 × 20", "min, max, step, value. text is the display template — %s is replaced by current value (e.g. Volume: %s). Draggable in Try Mode."],
                  ["scrollbar", "14 × 54", "axis (y / x), target (inventory_area ID). Cross-axis is locked to 14 px. See Scrollbars ↓"],
                ].map(([type, size, desc]) => (
                  <tr key={type}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{type}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{size}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Display */}
          <h3 className="text-base font-semibold mb-3">Display widgets</h3>
          <div className="rounded-xl border overflow-hidden mb-8">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2.5">Type</th>
                  <th className="text-left px-4 py-2.5">Default size</th>
                  <th className="text-left px-4 py-2.5">Key props</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  ["label", "80 × 10", "text, color (ARGB integer), shadow (true/false), align (left/center/right)."],
                  ["icon", "16 × 16", "icon (URL or resource key), scale."],
                  ["inventory_area", "162 × 54", "cols, rows, slot_size (default 18), source (empty / player / player_hotbar). Exported as container.slots, not widgets[]. See Inventory Areas ↓"],
                  ["list", "160 × 120", "item_height. Has an item_template array of icon/label widgets that define how each row looks."],
                ].map(([type, size, desc]) => (
                  <tr key={type}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{type}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{size}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="text-base font-semibold mb-3">Property panel</h3>
          <div className="flex flex-col sm:flex-row gap-6 mb-4">
            <div className="sm:w-64 shrink-0">
              <Screenshot src="/docs/widget-selected.png" alt="Property panel for a selected button" />
            </div>
            <div className="flex-1 text-sm space-y-2 text-muted-foreground">
              <p>Selecting a widget opens the <strong className="text-foreground">Property Panel</strong> on the right. It always shows:</p>
              <ul className="space-y-1.5">
                <li><strong className="text-foreground">ID</strong> — unique identifier used as the Java handle at runtime.</li>
                <li><strong className="text-foreground">X / Y</strong> — position relative to parent.</li>
                <li><strong className="text-foreground">W / H</strong> — pixel size.</li>
                <li><strong className="text-foreground">Text / Icon</strong> — shown blue italic when a binding is active for that field.</li>
                <li>Type-specific props (color, min/max, style, etc.).</li>
                <li><strong className="text-foreground">Action</strong> — the event fired on interaction.</li>
                <li><strong className="text-foreground">Bindings</strong> — map widget properties to data schema paths.</li>
              </ul>
            </div>
          </div>

          <Divider />

          {/* ── BINDINGS ──────────────────────────────────────────────── */}
          <SectionHeading
            id="bindings"
            label="04 — Bindings"
            title="Data bindings"
            sub="Drive widget properties from your mod's runtime data — and preview them live in the canvas."
          />

          <div className="flex flex-col sm:flex-row gap-6 mb-8">
            <div className="flex-1 text-sm space-y-3 text-muted-foreground">
              <p>
                Bindings connect a <strong className="text-foreground">widget property</strong> (like a label&apos;s
                text, or a panel&apos;s visibility) to a <strong className="text-foreground">schema path</strong> your
                mod pushes at runtime. The designer shows a live preview using the schema&apos;s preview values.
              </p>
              <p>
                Open the modal via the <strong className="text-foreground">network icon</strong> in the toolbar.
                The <strong className="text-foreground">Bindings</strong> tab shows your schema tree.
              </p>
            </div>
            <div className="sm:w-80 shrink-0">
              <Screenshot src="/docs/bindings-modal.png" alt="Data Schema — Bindings tab" />
            </div>
          </div>

          <h3 className="text-base font-semibold mb-4">Defining your schema</h3>
          <div className="border rounded-xl divide-y overflow-hidden mb-6">
            <Step n={1} title="Add a root property">
              <p>Fill in the name input, select a type (<Code>string</Code> / <Code>number</Code> / <Code>boolean</Code>), and optionally set a <strong>preview value</strong> shown in the canvas. Press <em>Add</em>.</p>
            </Step>
            <Step n={2} title="Add children">
              <p>Hover a node row → click <strong>+</strong> to add a child. Nested paths use dot notation: <Code>player.health</Code>, <Code>player.name</Code>.</p>
            </Step>
            <Step n={3} title="Edit as JSON">
              <p>Click <strong>Edit as JSON</strong> to paste or bulk-edit the full schema. Useful when migrating from another project.</p>
            </Step>
          </div>

          <h3 className="text-base font-semibold mb-4">Binding a widget to a schema path</h3>
          <div className="flex flex-col sm:flex-row gap-6 mb-6">
            <div className="sm:w-72 shrink-0">
              <Screenshot src="/docs/property-bindings.png" alt="Property panel showing an active binding" />
            </div>
            <div className="flex-1 text-sm space-y-3 text-muted-foreground">
              <p>Select a widget → <strong className="text-foreground">Property Panel</strong> → scroll to the <strong className="text-foreground">Bindings</strong> section → click <strong className="text-foreground">+ Add binding</strong>.</p>
              <ol className="list-decimal list-inside space-y-1.5">
                <li>Pick the <strong className="text-foreground">target</strong> (which prop to drive).</li>
                <li>Pick the <strong className="text-foreground">schema path</strong> (filtered to matching types).</li>
              </ol>
              <p className="mt-2 font-medium text-foreground">Bindable targets by widget type:</p>
              <div className="text-xs space-y-1">
                {[
                  ["button, toggle_button, input", "text (string), enabled (bool), visible (bool)"],
                  ["label", "text (string), visible (bool)"],
                  ["slider", "enabled (bool), visible (bool)"],
                  ["icon, panel", "visible (bool)"],
                ].map(([w, t]) => (
                  <div key={w} className="flex gap-2">
                    <Code>{w}</Code>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Callout kind="warn">
            A type mismatch (e.g. a <Code>number</Code> path bound to a <Code>text</Code> target) is flagged with an orange border and a ⚠ label. Fix it by selecting a path with the correct type.
          </Callout>

          <h3 className="text-base font-semibold mb-3 mt-6">Canvas preview behaviour</h3>
          <div className="grid sm:grid-cols-3 gap-3 mb-6">
            {[
              { title: "text binding", body: "Replaces the widget's static text with the preview value. Shown blue italic in the Property Panel." },
              { title: "visible = false", body: "Widget renders at 25% opacity in edit mode so you can still locate it." },
              { title: "enabled = false", body: "Widget gets a disabled appearance, matching in-game behaviour." },
            ].map((c) => (
              <div key={c.title} className="rounded-lg border p-3">
                <p className="text-xs font-semibold font-mono mb-1">{c.title}</p>
                <p className="text-xs text-muted-foreground">{c.body}</p>
              </div>
            ))}
          </div>

          <h3 className="text-base font-semibold mb-2">In the exported JSON</h3>
          <CodeBlock>{`// ScreenSpec — top level
"bindingsSchema": {
  "player": {
    "type": "string",
    "children": {
      "name":   { "type": "string",  "previewValue": "Steve" },
      "health": { "type": "number",  "previewValue": "20"    }
    }
  }
}

// On each widget
"bindings": {
  "text":    "player.name",
  "visible": "ui.show_label"
}`}
          </CodeBlock>

          <Divider />

          {/* ── ACTIONS ───────────────────────────────────────────────── */}
          <SectionHeading
            id="actions"
            label="05 — Actions"
            title="Actions"
            sub="Named events your widgets fire back to your mod when a player interacts with them."
          />

          <div className="flex flex-col sm:flex-row gap-6 mb-8">
            <div className="flex-1 text-sm space-y-3 text-muted-foreground">
              <p>
                Open the <strong className="text-foreground">Data Schema modal</strong> (network icon) →
                <strong className="text-foreground"> Actions</strong> tab. Type a{" "}
                <Code>snake_case</Code> name and press Enter or <em>Add</em>.
              </p>
              <p>
                If a <Code>modId</Code> is set, each action is displayed with its fully-qualified
                name (<Code>my_mod.save_settings</Code>) — that&apos;s what the runtime fires.
              </p>
              <p>
                To assign an action, select a widget and use the <strong className="text-foreground">Action</strong> dropdown in the Property Panel. It lists all declared actions.
              </p>
            </div>
            <div className="sm:w-80 shrink-0">
              <Screenshot src="/docs/actions-tab.png" alt="Data Schema — Actions tab" />
            </div>
          </div>

          <h3 className="text-base font-semibold mb-2">Handling actions in Java</h3>
          <CodeBlock>{`// Register a listener in your screen class
screen.on("save_settings", (id, screen, value) -> {
    // id    = widget ID that fired
    // value = current value (slider, toggle state, etc.)
    saveSettings();
});`}
          </CodeBlock>

          <h3 className="text-base font-semibold mb-2 mt-6">In the exported JSON</h3>
          <CodeBlock>{`// ScreenSpec — top level
"actions": ["save_settings", "reset_defaults"]

// On each widget
"action": "save_settings"`}
          </CodeBlock>

          <Divider />

          {/* ── SCROLLBARS ────────────────────────────────────────────── */}
          <SectionHeading
            id="scrollbars"
            label="06 — Scrollbars"
            title="Scrollbars"
            sub="Two complementary mechanisms — both drive inventory_area widgets."
          />

          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <div className="rounded-xl border p-5">
              <p className="font-semibold mb-2 text-sm">Built-in (automatic)</p>
              <p className="text-sm text-muted-foreground mb-3">
                The editor derives an <Code>inventory_area</Code>&apos;s size from its columns, rows,
                and slot size. At runtime, inventories with more slots than this viewport scroll automatically.
              </p>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li>— The designer shows the viewport grid sized by the configured columns and rows.</li>
                <li>— At runtime, the area scrolls when the bound inventory has more slots than fit.</li>
                <li>— Suppressed when an explicit <Code>scrollbar</Code> widget targets the same axis.</li>
              </ul>
            </div>
            <div className="rounded-xl border p-5">
              <p className="font-semibold mb-2 text-sm">Explicit scrollbar widget</p>
              <p className="text-sm text-muted-foreground mb-3">
                Add a standalone <Code>scrollbar</Code> widget, set its <Code>axis</Code> and
                <Code> target</Code> (an <Code>inventory_area</Code> ID).
              </p>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li>— Cross-axis is locked to 14 px; only length is resizable.</li>
                <li>— Renders the MC scrollbar handle texture.</li>
                <li>— In Try Mode: draggable thumb + click-on-track jumps to position.</li>
              </ul>
            </div>
          </div>

          <h3 className="text-base font-semibold mb-3">Setting up an explicit scrollbar</h3>
          <div className="border rounded-xl divide-y overflow-hidden mb-6">
            <Step n={1} title="Add the inventory_area">
              <p>Add an <Code>inventory_area</Code> widget. Set <Code>cols</Code>, <Code>rows</Code>, and <Code>slot_size</Code>. Give it a meaningful ID like <Code>item_slots</Code>.</p>
            </Step>
            <Step n={2} title="Add a scrollbar">
              <p>Add a <Code>scrollbar</Code> widget. Position it beside the inventory area.</p>
            </Step>
            <Step n={3} title="Link them">
              <p>In the Property Panel, set <strong>Target</strong> to <Code>item_slots</Code>. The editor shows a dropdown pre-populated with all valid inventory area IDs on the current screen.</p>
            </Step>
            <Step n={4} title="Verify in Try Mode">
              <p>Press <Code>T</Code> to check the configured viewport size. At runtime, the linked scrollbar moves through the bound inventory when it exceeds that viewport.</p>
            </Step>
          </div>

          <Callout kind="note">
            If the linked inventory area ID is renamed or deleted, the Property Panel shows a ⚠ warning. Update the <Code>target</Code> prop or delete the orphaned scrollbar.
          </Callout>

          <Divider />

          {/* ── INVENTORY AREAS ───────────────────────────────────────── */}
          <SectionHeading
            id="inventory"
            label="07 — Inventory"
            title="Inventory areas"
            sub="Tiled MC slot grids that live in container.slots — not in widgets[]."
          />

          <p className="text-sm text-muted-foreground mb-6">
            <Code>inventory_area</Code> is a special widget type that renders a grid of MC slot tiles.
            Unlike other widgets, it is exported into <Code>container.slots</Code>, not the
            <Code> widgets</Code> array.
          </p>

          <div className="grid sm:grid-cols-2 gap-3 mb-8 text-sm">
            {[
              { prop: "cols", desc: "Number of slot columns; determines width with slot_size" },
              { prop: "rows", desc: "Visible row count; determines height with slot_size" },
              { prop: "slot_size", desc: "Pixel size per slot (default 18 — vanilla MC); W = cols × slot_size, H = rows × slot_size" },
              { prop: "source", desc: "empty = custom, player = player inventory, player_hotbar = hotbar" },
              { prop: "slot_hints", desc: "Optional empty-slot silhouettes: helmet, chestplate, leggings, boots, or shield/offhand" },
            ].map((r) => (
              <div key={r.prop} className="rounded-lg border p-3 flex gap-3">
                <Code>{r.prop}</Code>
                <span className="text-muted-foreground text-xs">{r.desc}</span>
              </div>
            ))}
          </div>

          <h3 className="text-base font-semibold mb-2">Export format</h3>
          <p className="text-sm text-muted-foreground mb-3">
            <Code>viewport_rows</Code> is computed automatically as <Code>floor(height / slot_size)</Code>.
            The runtime determines the actual total row count from your mod&apos;s data.
          </p>
          <CodeBlock>{`{
  "widgets": [ /* panel, buttons, labels … */ ],
  "container": {
    "slots": [
      {
        "id": "item_slots",
        "x": 8,
        "y": 20,
        "cols": 9,
        "slot_size": 18,
        "viewport_rows": 3,
        "source": "",
        "slot_hints": { "0": "helmet", "1": "chestplate", "2": "leggings", "3": "boots", "8": "shield" }
      }
    ]
  }
}`}
          </CodeBlock>

          <Callout kind="warn" >
            Duplicate <Code>inventory_area</Code> IDs are caught at export time — you&apos;ll see an alert before any file is downloaded.
          </Callout>

          <Divider />

          {/* ── TRY MODE ──────────────────────────────────────────────── */}
          <SectionHeading
            id="try-mode"
            label="08 — Preview"
            title="Try mode"
            sub="Experience your screen as a player would — fully interactive, no code."
          />

          <div className="flex flex-col sm:flex-row gap-6 mb-8">
            <div className="sm:w-80 shrink-0">
              <Screenshot src="/docs/try-mode.png" alt="Try mode — interactive preview" />
            </div>
            <div className="flex-1 text-sm space-y-3 text-muted-foreground">
              <p>
                Press <Code>T</Code> or click <strong className="text-foreground">▶ Try</strong> in the toolbar.
                The sidebar and Property Panel disappear — only the canvas remains.
              </p>
              <p className="font-medium text-foreground">What you can interact with:</p>
              <ul className="space-y-1.5">
                <li><Code>button</Code> — hover + press animation</li>
                <li><Code>toggle_button</Code> — click to toggle; grouped toggles act as radio buttons (green when active)</li>
                <li><Code>slider</Code> — drag the handle; <Code>%s</Code> in the label updates live</li>
                <li><Code>input</Code> — click to focus, type text; MC blinking cursor; respects <Code>max_length</Code></li>
                <li><Code>scroll</Code> — mouse wheel scrolls children</li>
                <li><Code>inventory_area</Code> — mouse wheel scrolls slot grid</li>
                <li><Code>scrollbar</Code> — drag thumb or click track</li>
              </ul>
              <p>Press <Code>Escape</Code> or <strong className="text-foreground">⏹ Stop</strong> to exit.</p>
            </div>
          </div>

          <Divider />

          {/* ── EXPORT ────────────────────────────────────────────────── */}
          <SectionHeading
            id="export"
            label="09 — Export"
            title="Export & Import"
            sub="Export your screen as JSON for your mod or PNG for sharing."
          />

          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <div className="rounded-xl border p-5">
              <p className="font-semibold mb-2 text-sm">Export (↓)</p>
              <p className="text-sm text-muted-foreground">
                Click the <strong>download icon</strong> in the toolbar. Downloads
                <Code>{" {screenId}.json"}</Code> — the complete <Code>ScreenSpec</Code> for the
                active screen. Only the active screen is exported; switch screens in the sidebar to
                export others.
              </p>
            </div>
            <div className="rounded-xl border p-5">
              <p className="font-semibold mb-2 text-sm">Import (↑)</p>
              <p className="text-sm text-muted-foreground">
                Click the <strong>upload icon</strong>, select a <Code>.json</Code> file. The current
                screen is replaced (an undo entry is created). The file must have an <Code>id</Code> and
                a <Code>widgets</Code> array.
              </p>
            </div>
            <div className="rounded-xl border p-5">
              <p className="font-semibold mb-2 text-sm">Export PNG</p>
              <p className="text-sm text-muted-foreground">
                Click the image icon in the toolbar to download a PNG of the active screen. The image
                uses the screen&apos;s Minecraft-pixel dimensions and leaves out the editor grid and selection handles.
              </p>
            </div>
          </div>

          <Divider />

          {/* ── SHORTCUTS ─────────────────────────────────────────────── */}
          <SectionHeading
            id="shortcuts"
            label="10 — Reference"
            title="Keyboard shortcuts"
          />

          <div className="rounded-xl border overflow-hidden mb-8">
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {[
                  ["⌘ Z", "Undo"],
                  ["⌘ ⇧ Z  or  ⌘ Y", "Redo"],
                  ["⌘ =  or  ⌘ +", "Zoom in"],
                  ["⌘ −", "Zoom out"],
                  ["⌘ 0", "Reset zoom to fit"],
                  ["⌘ C", "Copy selected widget"],
                  ["⌘ V", "Paste (+8 px offset)"],
                  ["⌘ D", "Duplicate (+8 px offset)"],
                  ["Delete / Backspace", "Delete selected widget"],
                  ["Escape", "Deselect; or exit Try Mode"],
                  ["T", "Toggle Try Mode"],
                  ["Arrow keys", "Nudge widget 1 px"],
                  ["⇧ + Arrow keys", "Nudge by snap size"],
                  ["⌘ + Scroll wheel", "Zoom on canvas"],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td className="px-4 py-2.5 w-56">
                      <kbd className="text-xs font-mono bg-muted rounded px-2 py-0.5">{k}</kbd>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Divider />

          {/* ── JSON REFERENCE ────────────────────────────────────────── */}
          <SectionHeading
            id="json"
            label="11 — Reference"
            title="Full JSON reference"
            sub="A complete annotated ScreenSpec with every field."
          />

          <CodeBlock>{`{
  // ── Identity ───────────────────────────────────────────────────────
  "id":     "main",      // Filename when exported: main.json
  "modId":  "my_mod",    // Qualifies binding paths & action IDs in Java
  "width":  320,         // Screen width  in MC pixels
  "height": 180,         // Screen height in MC pixels

  // ── Declared actions ───────────────────────────────────────────────
  "actions": ["save_settings", "reset_defaults"],

  // ── Data schema ────────────────────────────────────────────────────
  "bindingsSchema": {
    "player": {
      "type": "string",          // Parent node — can still have a preview
      "children": {
        "name":   { "type": "string",  "previewValue": "Steve" },
        "health": { "type": "number",  "previewValue": "20"    },
        "online": { "type": "boolean", "previewValue": "true"  }
      }
    },
    "ui": {
      "type": "string",
      "children": {
        "show_panel": { "type": "boolean", "previewValue": "true" }
      }
    }
  },

  // ── Widget tree ────────────────────────────────────────────────────
  "widgets": [
    {
      "id": "bg", "type": "panel",
      "x": 0, "y": 0, "w": 320, "h": 180,
      "props": { "style": "default" },
      "bindings": { "visible": "ui.show_panel" }
    },
    {
      "id": "title", "type": "label",
      "x": 8, "y": 8, "w": 160, "h": 10,
      "props": { "text": "Player Info", "color": "4210752",
                 "shadow": "false", "align": "left" },
      "bindings": { "text": "player.name" }
    },
    {
      "id": "mode_a", "type": "toggle_button",
      "x": 8, "y": 30, "w": 60, "h": 14,
      "props": { "text": "Mode A", "group": "mode" }   // radio group
    },
    {
      "id": "vol", "type": "slider",
      "x": 8, "y": 52, "w": 150, "h": 14,
      "props": { "text": "Volume: %s",                 // %s = current value
                 "min": "0", "max": "100",
                 "step": "1", "value": "50" }
    },
    {
      "id": "search", "type": "input",
      "x": 8, "y": 72, "w": 150, "h": 14,
      "props": { "hint_text": "Search…", "max_length": "32" }
    },
    {
      "id": "save_btn", "type": "button",
      "x": 8, "y": 158, "w": 72, "h": 14,
      "props": { "text": "Save" },
      "action": "save_settings"
    },
    {
      "id": "close_btn", "type": "button",
      "x": 88, "y": 158, "w": 72, "h": 14,
      "props": { "text": "Close" },
      "action": "close"
    },
    {
      "id": "item_scroll", "type": "scrollbar",
      "x": 302, "y": 100, "w": 14, "h": 52,
      "props": { "axis": "y", "target": "item_slots" }
    }
  ],

  // ── Inventory slot areas ────────────────────────────────────────────
  // inventory_area widgets are NOT in widgets[] — they live here.
  "container": {
    "slots": [
      {
        "id": "item_slots",
        "x": 165, "y": 100,
        "cols": 7,
        "slot_size": 18,
        "viewport_rows": 2,   // floor(height / slot_size)
        "source": ""          // "" | "player" | "player_hotbar"
      }
    ]
  }
}`}
          </CodeBlock>

        </main>
      </div>
    </div>
  );
}
