"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

export type Locale = "en" | "zh";

const translations: Record<string, string> = {
  "Visual designer for Minecraft mod GUI screens": "Minecraft 模组 GUI 界面可视化设计器",
  "No projects yet": "暂无项目",
  "just now": "刚刚",
  "New Project": "新建项目",
  "Load Project": "加载项目",
  "Edit test screen": "编辑测试界面",
  "First screen ID": "首个界面 ID",
  "Your mod's namespace — qualifies binding and action IDs automatically": "模组命名空间，会自动为绑定和操作 ID 添加前缀",
  "Cancel": "取消",
  "Create": "创建",
  "Delete project?": "删除项目？",
  "will be permanently deleted. This can't be undone.": "将被永久删除，此操作无法撤销。",
  "Delete": "删除",
  "Settings": "设置",
  "Snapping settings": "对齐设置",
  "Snapping": "吸附",
  "Grid": "网格",
  "Snap size": "吸附间距",
  "Reset snap": "重置吸附间距",
  "Snap to parent center": "吸附到父级中心",
  "Snap to siblings": "吸附到同级组件",
  "Undo": "撤销",
  "Redo": "重做",
  "Zoom out (⌘-)": "缩小 (⌘-)",
  "Reset zoom (⌘0)": "重置缩放 (⌘0)",
  "Zoom in (⌘+)": "放大 (⌘+)",
  "Stop": "停止",
  "Try": "预览",
  "Toggle try mode (T)": "切换预览模式 (T)",
  "Copy Java class definition": "复制 Java 类定义",
  "Import project (all screens)": "导入项目（所有界面）",
  "Export project (all screens)": "导出项目（所有界面）",
  "Export selected widget as PNG": "将选中组件导出为 PNG",
  "Select a widget to export as PNG": "选择组件后即可导出为 PNG",
  "Documentation": "使用文档",
  "Save to test mod": "保存到测试模组",
  "Back to projects": "返回项目列表",
  "Unnamed project": "未命名项目",
  "Screens": "界面",
  "Layers": "图层",
  "Drag to reorder": "拖动以重新排序",
  "Import screen JSON": "导入界面 JSON",
  "Add screen": "添加界面",
  "Export screen JSON": "导出界面 JSON",
  "Rename": "重命名",
  "Widgets": "组件",
  "widgets selected": "个组件已选中",
  "Properties apply to the primary selection.": "属性面板正在编辑主要选中项。",
  "Clear selection": "清除选择",
  "Horizontal center": "水平居中",
  "Vertical center": "垂直居中",
  "Distribute horizontally": "水平等间距",
  "Distribute vertically": "垂直等间距",
  "Project": "项目",
  "Appearance": "外观",
  "Theme": "主题",
  "Textures": "纹理",
  "Load from JAR / Resource Pack": "从 JAR / 资源包加载",
  "Upload your own ": "上传你自己的 ",
  " or a ": " 或 ",
  " resource pack — textures are extracted client-side and never sent to a server.": " 资源包。纹理仅在本地提取，不会上传到服务器。",
  "Browse": "浏览",
  "View Textures": "查看纹理",
  "Browse loaded texture atlas": "浏览已加载的纹理图集",
  "Open": "打开",
  "Reset Textures": "重置纹理",
  "Remove all custom textures": "移除所有自定义纹理",
  "Reset": "重置",
  "Pick texture": "选择纹理",
  "Search…": "搜索…",
  "No textures match": "没有匹配的纹理",
  "Empty folder": "文件夹为空",
  "select a texture to preview": "选择纹理以预览",
  "Text": "文本",
  "Icon": "图标",
  "Extract a resource pack first": "请先提取资源包",
  "Change icon": "更换图标",
  "Pick icon…": "选择图标…",
  "Widget Props": "组件属性",
  "Change texture": "更换纹理",
  "Pick texture…": "选择纹理…",
  "Min": "最小值",
  "Max": "最大值",
  "Action": "操作",
  "Bindings": "数据绑定",
  "(none)": "（无）",
  "Data Schema": "数据结构",
  "Edit as JSON": "以 JSON 编辑",
  "Apply": "应用",
  "Edit bindings schema": "编辑绑定结构",
  "Set a modId in settings to enable scoped path generation": "请在设置中填写 Mod ID 以启用带命名空间的路径生成",
  "Texture Setup": "纹理设置",
  "Try loading default textures again": "重试加载默认纹理",
  "Load local textures again": "重新加载本地纹理",
  "Couldn’t load local Minecraft textures. Try again, or load your own game files — extracted locally, nothing leaves your browser.": "无法加载本地 Minecraft 纹理。请重试，或加载自己的游戏文件。文件仅在本地提取，不会离开浏览器。",
  "Load from Minecraft JAR or resource pack": "从 Minecraft JAR 或资源包加载",
  "Select your ": "选择你的 ",
  " from your Minecraft install, or any ": "（位于 Minecraft 安装目录），或任意 ",
  ".zip resource pack.": ".zip 资源包。",
  "Extracting textures…": "正在提取纹理…",
  "Browse for JAR / ZIP": "选择 JAR / ZIP 文件",
  "Failed to read file.": "读取文件失败。",
  "Language": "语言",
  "All textures": "所有纹理",
  "Select": "选择",
  "bindings": "数据绑定",
  "actions": "操作",
  "No actions defined yet.": "尚未定义操作。",
  "Create new action…": "创建新操作…",
  "action name": "操作名称",
  "Properties are qualified as": "在 Java 中，属性会使用命名空间",
  "in Java": "",
  "No number bindings defined": "未定义数值绑定",
  "No boolean bindings defined": "未定义布尔值绑定",
  "No string bindings defined": "未定义字符串绑定",
  "Select a widget to edit its properties.": "选择一个组件以编辑其属性。",
  "Group": "分组",
  "Panel": "面板",
  "Tabs": "标签页",
  "Tab": "标签",
  "Button": "按钮",
  "Toggle Button": "切换按钮",
  "Checkbox": "复选框",
  "Input": "输入框",
  "Slider": "滑块",
  "Label": "文本标签",
  "Scrollbar": "滚动条",
  "Inventory Area": "物品栏区域",
  "Player Preview": "玩家预览",
  "Sprite": "精灵图",
  "Progress Bar": "进度条",
  "Health Bar": "血量条",
  "Hunger Bar": "饥饿条",
  "Armor Bar": "护甲条",
  "Air Bar": "氧气条",
  "Experience Bar": "经验条",
  "Requirement": "需求条件",
  "Custom": "自定义组件",
  "List": "列表",
  "Style": "样式",
  "Tab Height": "标签高度",
  "Group ID": "分组 ID",
  "Checked": "已选中",
  "Max Length": "最大长度",
  "Hint Text": "提示文本",
  "Step": "步进值",
  "Default Value": "默认值",
  "Max Value": "最大值",
  "Bubble Count": "气泡数量",
  "Color (ARGB int)": "颜色（ARGB 整数）",
  "Shadow": "阴影",
  "Align": "水平对齐",
  "Vertical Align": "垂直对齐",
  "Axis": "方向",
  "Target widget ID": "目标组件 ID",
  "Columns": "列数",
  "Preview rows": "预览行数",
  "Slot Size": "槽位大小",
  "Slot hint": "槽位提示",
  "Select a slot, then choose its hint.": "选择格子后设置提示图标。",
  "Slot": "格子",
  "None": "无",
  "helmet": "头盔",
  "chestplate": "胸甲",
  "leggings": "护腿",
  "boots": "靴子",
  "shield": "盾牌（副手）",
  "Source": "来源",
  "Texture": "纹理",
  "Fit": "适配方式",
  "Color": "颜色",
  "Show %": "显示百分比",
  "Color (Met)": "满足时颜色",
  "Color (Unmet)": "未满足时颜色",
  "Border Width": "边框宽度",
  "Custom Type": "自定义类型",
  "Item Height (px)": "项目高度（像素）",
  "left": "左对齐",
  "center": "居中",
  "right": "右对齐",
  "top": "顶部",
  "middle": "垂直居中",
  "bottom": "底部",
  "default": "默认",
  "dark": "深色",
  "transparent": "透明",
  "threshold": "阈值",
  "solid": "实心",
  "fill": "填充",
  "contain": "完整显示",
  "cover": "覆盖",
  "tile": "平铺",
  "none": "无",
  "player": "玩家背包",
  "player_hotbar": "玩家快捷栏",
  "Couldn’t automatically load the default textures (probably a network issue). Try again, or load your own game files instead — extracted locally, nothing leaves your browser.": "无法自动加载默认纹理（可能是网络问题）。请重试，或加载自己的游戏文件。文件仅在本地提取，不会离开浏览器。",
  "Minecraft.jar": "Minecraft.jar",
  " resource pack.": " 资源包。",
  "extracted": "已提取",
  "not found:": "未找到：",
  "textures extracted": "个纹理已提取",
  "not found in this pack": "个纹理未在此资源包中找到",
  "Show": "显示",
  "Hide": "隐藏",
  "Add tab": "添加标签",
  "Add widget": "添加组件",
  "Add child": "添加子组件",
  "name": "名称",
  "preview value": "预览值",
  "preview value (optional)": "预览值（可选）",
  "preview": "预览",
  "Double-click to rename": "双击重命名",
  "Add child property": "添加子属性",
  "We use cookies to understand how you use this app and improve it. You can accept or decline non-essential analytics cookies.": "我们使用 Cookie 了解你如何使用本应用并持续改进。你可以接受或拒绝非必要的分析 Cookie。",
  "Decline": "拒绝",
  "Accept": "接受",
  "Light": "浅色",
  "Dark": "深色",
  "System": "跟随系统",
  "Mod ID": "模组 ID",
  "Namespace prepended to action and binding IDs when no colon is present.": "未填写冒号时，会为操作和绑定 ID 自动添加此命名空间。",
  "Failed to load project: invalid or corrupt JSON.": "加载项目失败：JSON 无效或已损坏。",
  "Could not load test screen: ": "无法加载测试界面：",
  "Loading…": "正在加载…",
  "Select a texture": "选择纹理",
  "Expected a JSON array of strings": "需要一个由字符串组成的 JSON 数组",
  "Invalid JSON": "JSON 无效",
  "Remove": "移除",
  "Add": "添加",
  "Name": "名称",
  "Value": "值",
  "Close": "关闭",
  "Save": "保存",
  "Light theme": "浅色主题",
  "Dark theme": "深色主题",
  "System theme": "跟随系统主题",
  "Failed to load default textures": "默认纹理加载失败",
  "Retrying…": "正在重试…",
};

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (text: string) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  setLocale: () => undefined,
  t: (text) => text,
});

const LOCALE_KEY = "mc-ui-builder-locale";
const localeListeners = new Set<() => void>();

function subscribeLocale(listener: () => void) {
  localeListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    localeListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getLocaleSnapshot(): Locale {
  const stored = localStorage.getItem(LOCALE_KEY);
  return stored === "zh" ? "zh" : "en";
}

function getServerLocaleSnapshot(): Locale {
  return "en";
}

function storeLocale(locale: Locale) {
  localStorage.setItem(LOCALE_KEY, locale);
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  localeListeners.forEach((listener) => listener());
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribeLocale, getLocaleSnapshot, getServerLocaleSnapshot);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    setLocale: storeLocale,
    t: (text) => locale === "zh" ? (translations[text] ?? text) : text,
  }), [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}
