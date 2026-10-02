// Category names, icons and colours: safe to ship to the browser (the word lists stay on the server).
export interface CategoryMeta {
  id: number;
  name: string;
  icon: string;
  color: string; // tile colour
}

export const CATEGORY_META: CategoryMeta[] = [
  { id: 0, name: "אוכל ושתייה", icon: "🍽️", color: "#f97316" },
  { id: 1, name: "חיות וטבע", icon: "🐾", color: "#22c55e" },
  { id: 2, name: "בית וחפצים", icon: "🏠", color: "#0ea5e9" },
  { id: 3, name: "מקומות ותחבורה", icon: "🌍", color: "#8b5cf6" },
  { id: 4, name: "אנשים ותרבות", icon: "🎭", color: "#ec4899" },
  { id: 5, name: "מושגים ופעולות", icon: "💭", color: "#eab308" },
];
