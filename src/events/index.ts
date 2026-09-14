import { EVENTS_MANIFEST } from "./manifest";

// 一覧画面用の軽量な目次（タイトルのみ）。
export { EVENTS_MANIFEST };

export const eventIds = Object.keys(EVENTS_MANIFEST);

export function eventExists(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(EVENTS_MANIFEST, id);
}

// 各イベントの本体データ（ステージ・タイムテーブル）は、
// 選択されて実際に必要になるまで読み込まない（動的import）。
const dataLoaders = import.meta.glob<{ default: any }>([
  "./*.ts",
  "!./manifest.ts",
  "!./index.ts",
]);

export async function loadEventData(id: string) {
  const loader = dataLoaders[`./${id}.ts`];
  if (!loader) return null;
  const mod = await loader();
  return mod.default;
}
