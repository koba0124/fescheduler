<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import {
  Heart,
  Clock,
  Calendar,
  AlertCircle,
  Check,
  Twitter,
  Link as LinkIcon,
  List,
  Grid,
  MapPin,
  ChevronRight,
  Home,
  EyeOff,
  LogIn,
  Menu,
  X,
  Import,
  LogOut, // 追加: 戻る用アイコン
} from "lucide-vue-next";

// ==========================================
// データ・設定定義セクション
// ==========================================

const APP_NAME = "FEScheduler";
import { EVENTS_DB } from "./events";

// ==========================================
// ロジック
// ==========================================

// --- ルーティング管理 ---
const currentHash = ref(window.location.hash);
const eventId = computed(() => {
  let hash = currentHash.value.replace(/^#\//, "").replace(/^#/, "");
  hash = hash.split("?")[0];
  return hash.split("/")[0] || "";
});

const currentView = computed(() => {
  if (!eventId.value) return "list";
  if (EVENTS_DB[eventId.value]) return "timetable";
  return "404";
});

const updateHash = () => {
  currentHash.value = window.location.hash;
};
onMounted(() => window.addEventListener("hashchange", updateHash));
onUnmounted(() => window.removeEventListener("hashchange", updateHash));

// --- 共通ロジック ---
const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
};

// --- ステート管理 ---
const favorites = ref([]);
const hiddenStageIds = ref([]);
const showOnlyFavorites = ref(false);
const currentTime = ref(new Date());
const copied = ref(false);
const viewMode = ref("grid");
const isMenuOpen = ref(false);
const isSharedMode = ref(false); // 追加: 共有モード（リードオンリー）フラグ

const PIXELS_PER_MINUTE = 2.5;

const eventData = computed(() => EVENTS_DB[eventId.value] || null);

const startHour = computed(() => eventData.value?.startHour ?? 10);
const endHour = computed(() => eventData.value?.endHour ?? 21);
const startMinutes = computed(() => startHour.value * 60);

// --- Computed: ステージ表示・グルーピング制御 ---

const visibleStagesRaw = computed(() => {
  if (!eventData.value) return [];
  return eventData.value.stages.filter(
    (s) => !hiddenStageIds.value.includes(s.id),
  );
});

const hiddenStages = computed(() => {
  if (!eventData.value) return [];
  return eventData.value.stages.filter((s) =>
    hiddenStageIds.value.includes(s.id),
  );
});

const groupedVisibleStages = computed(() => {
  const stages = visibleStagesRaw.value;
  const result = [];
  let currentGroup = null;

  stages.forEach((stage) => {
    const gName = stage.group || "";
    if (!currentGroup || currentGroup.name !== gName) {
      currentGroup = { name: gName, stages: [] };
      result.push(currentGroup);
    }
    currentGroup.stages.push(stage);
  });

  return result;
});

const toggleStageVisibility = (stageId) => {
  if (hiddenStageIds.value.includes(stageId)) {
    hiddenStageIds.value = hiddenStageIds.value.filter((id) => id !== stageId);
  } else {
    hiddenStageIds.value = [...hiddenStageIds.value, stageId];
  }
};

// --- お気に入り管理 ---
const loadFavorites = () => {
  if (!eventData.value) return;

  let queryString = "";
  if (window.location.hash.includes("?")) {
    queryString = window.location.hash.split("?")[1];
  } else if (window.location.search) {
    queryString = window.location.search.substring(1);
  }

  const params = new URLSearchParams(queryString);
  const sharedIds = params.get("ids");

  if (sharedIds) {
    // URLにidsがある場合：共有モードとして読み込む
    try {
      const parsed = sharedIds
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n));
      if (parsed.length > 0) {
        favorites.value = parsed;
        isSharedMode.value = true; // 共有モードON
        return; // ローカルストレージ読み込みをスキップ
      }
    } catch (e) {
      console.error(e);
    }
  }

  // 通常モード
  isSharedMode.value = false;
  const key = `fescheduler_favs_${eventId.value}`;
  const stored = localStorage.getItem(key);
  if (stored) favorites.value = JSON.parse(stored);
  else favorites.value = [];
};

watch(
  eventId,
  () => {
    favorites.value = [];
    hiddenStageIds.value = [];
    isMenuOpen.value = false;
    loadFavorites();
  },
  { immediate: true },
);

watch(
  favorites,
  (newVal) => {
    // 共有モードでない場合のみローカルストレージを更新
    if (eventData.value && !isSharedMode.value) {
      localStorage.setItem(
        `fescheduler_favs_${eventId.value}`,
        JSON.stringify(newVal),
      );
    }
  },
  { deep: true },
);

// 共有スケジュールを取り込む機能
const importSharedSchedule = () => {
  if (
    !confirm(
      "現在表示中のスケジュールを、自分のスケジュールとして保存（上書き）しますか？",
    )
  ) {
    return;
  }

  // 共有モードを解除
  isSharedMode.value = false;

  // 現在のfavoritesをローカルストレージに強制保存
  localStorage.setItem(
    `fescheduler_favs_${eventId.value}`,
    JSON.stringify(favorites.value),
  );

  // URLからクエリパラメータを削除して履歴を更新
  const baseUrl = window.location.href.split("?")[0];
  window.history.replaceState(null, "", baseUrl);

  alert("スケジュールを保存しました。編集可能になります。");
};

// 追加: 共有モードを終了して通常モード（自分のローカルデータ）に戻る
const exitSharedMode = () => {
  // URLからクエリパラメータを削除して履歴を更新
  const baseUrl = window.location.href.split("?")[0];
  window.history.replaceState(null, "", baseUrl);

  // 共有モードフラグをオフにして再読み込み
  // loadFavorites内でURLパラメータがないことを検知してローカルストレージを読みに行く
  isSharedMode.value = false;
  loadFavorites();
};

onMounted(() => {
  const timer = setInterval(() => (currentTime.value = new Date()), 60000);
  onUnmounted(() => clearInterval(timer));
});

const toggleFavorite = (id) => {
  // 共有モード中は変更不可
  if (isSharedMode.value) return;

  if (favorites.value.includes(id)) {
    favorites.value = favorites.value.filter((i) => i !== id);
  } else {
    favorites.value = [...favorites.value, id];
  }
};

const handleCopyLink = () => {
  const currentUrl = window.location.href;
  const baseUrl = currentUrl.includes("?")
    ? currentUrl.split("?")[0]
    : currentUrl;

  const params =
    favorites.value.length > 0 ? `?ids=${favorites.value.join(",")}` : "";
  const url = `${baseUrl}${params}`;

  navigator.clipboard.writeText(url).then(() => {
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  });
};

const handleTwitterShare = () => {
  const currentUrl = window.location.href;
  const baseUrl = currentUrl.includes("?")
    ? currentUrl.split("?")[0]
    : currentUrl;

  const params =
    favorites.value.length > 0 ? `?ids=${favorites.value.join(",")}` : "";
  const url = `${baseUrl}${params}`;
  // 修正: ハッシュタグをシンプルに、改行を追加
  const text = `${eventData.value.title}のマイタイムテーブルを作成しました！\n\n#${APP_NAME}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  window.open(twitterUrl, "_blank");
};

// --- データ算出 ---
const favoriteEvents = computed(() => {
  if (!eventData.value) return [];
  return eventData.value.schedules.filter((e) =>
    favorites.value.includes(e.id),
  );
});

const displayedEvents = computed(() => {
  if (!eventData.value) return [];
  return showOnlyFavorites.value
    ? favoriteEvents.value
    : eventData.value.schedules;
});

const sortedFavorites = computed(() => {
  return [...favoriteEvents.value].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
  );
});

const timeSlots = computed(() => {
  const slots = [];
  for (let h = startHour.value; h <= endHour.value; h++) {
    slots.push(`${h}:00`);
    if (h !== endHour.value) slots.push(`${h}:30`);
  }
  return slots;
});

const currentPos = computed(() => {
  const now = currentTime.value;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  if (
    currentMinutes < startMinutes.value ||
    currentMinutes > endHour.value * 60
  )
    return null;
  return (currentMinutes - startMinutes.value) * PIXELS_PER_MINUTE;
});

const isBlocked = (targetEvent) => {
  if (favorites.value.includes(targetEvent.id)) return false;
  const tStart = timeToMinutes(targetEvent.startTime);
  const tEnd = timeToMinutes(targetEvent.endTime);
  return favoriteEvents.value.some((f) => {
    const fStart = timeToMinutes(f.startTime);
    const fEnd = timeToMinutes(f.endTime);
    return tStart < fEnd && tEnd > fStart;
  });
};

const getStageName = (id) => {
  return eventData.value?.stages.find((s) => s.id === id)?.name || id;
};

// メニュー操作用: クリックしたらメニューを閉じるラッパー
const withCloseMenu = (fn) => {
  fn();
  isMenuOpen.value = false;
};
</script>

<template>
  <div
    class="flex flex-col h-screen bg-gray-50 font-sans text-gray-800 overflow-hidden select-none"
  >
    <!-- ========================================== -->
    <!--  イベント一覧 (Landing Page) -->
    <!-- ========================================== -->
    <div
      v-if="currentView === 'list'"
      class="min-h-screen bg-gray-50 flex flex-col w-full"
    >
      <header class="bg-white border-b border-gray-200 py-4 px-6 shadow-sm">
        <h1 class="text-2xl font-bold text-indigo-600 flex items-center gap-2">
          <Calendar class="w-8 h-8" />
          {{ APP_NAME }}
        </h1>
      </header>
      <main class="flex-1 max-w-4xl mx-auto w-full p-6">
        <h2 class="text-xl font-bold text-gray-800 mb-6">イベント一覧</h2>
        <div class="grid gap-4 md:grid-cols-2">
          <a
            v-for="(data, key) in EVENTS_DB"
            :key="key"
            :href="`#/${key}`"
            class="block group"
          >
            <div
              class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 transition-all group-hover:shadow-md group-hover:border-indigo-300 flex justify-between items-center"
            >
              <div>
                <h3
                  class="text-xl font-bold text-gray-800 group-hover:text-indigo-600 mb-2"
                >
                  {{ data.title }}
                </h3>
              </div>
              <ChevronRight
                class="w-6 h-6 text-gray-300 group-hover:text-indigo-500"
              />
            </div>
          </a>
        </div>
        <h2 class="text-xl font-bold text-gray-800 mb-6">注意事項</h2>
        <div class="grid gap-4 md:grid-cols-1">
          このアプリは個人で作成されたものであり、イベントの主催者とは一切関係ありません。<br />
          ご自由にお使いいただけますが、掲載されているイベント情報が最新のものである保証はありません。<br />
          <b>最新の情報は、公式の発表やウェブサイトをご確認ください。</b><br />
          <br />
          このアプリの利用により生じたいかなる損害についても、作者は一切の責任を負いかねますので、ご了承ください。<br />
          また、バグ報告・機能要望は歓迎いたしますが、対応をお約束するものではありません。
          <a
            href="https://twitter.com/asami_konno"
            target="_blank"
            class="text-indigo-600 hover:underline"
            >ご連絡はこちらまでお願いします</a
          ><br />
        </div>
      </main>
      <footer class="text-center py-6 text-gray-400 text-sm">
        &copy; {{ APP_NAME }} created by 小判
      </footer>
    </div>

    <!-- ========================================== -->
    <!--  404 Not Found -->
    <!-- ========================================== -->
    <div
      v-else-if="currentView === '404'"
      class="flex flex-col items-center justify-center h-screen bg-gray-50 p-4 w-full"
    >
      <AlertCircle class="w-12 h-12 text-gray-400 mb-4" />
      <h2 class="text-xl font-bold text-gray-800 mb-2">
        イベントが見つかりません
      </h2>
      <p class="text-gray-600 mb-6">
        ID: {{ eventId }} は存在しないか、削除されました。
      </p>
      <a
        href="#/"
        class="px-6 py-2 bg-indigo-600 text-white rounded-full font-bold hover:bg-indigo-700 transition-colors"
      >
        イベント一覧へ戻る
      </a>
    </div>

    <!-- ========================================== -->
    <!--  タイムテーブル画面 -->
    <!-- ========================================== -->
    <template v-else>
      <!-- 共有モード時のインフォメーションバー -->
      <div
        v-if="isSharedMode"
        class="flex-none bg-indigo-600 text-white px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm shadow-md z-40 relative"
      >
        <div class="flex items-center gap-2">
          <AlertCircle class="w-4 h-4 text-indigo-200 flex-shrink-0" />
          <span class="font-bold">共有されたスケジュールを表示中</span>
        </div>
        <div class="flex items-center gap-2 w-full sm:w-auto">
          <button
            @click="exitSharedMode"
            class="flex-1 sm:flex-none text-indigo-100 px-3 py-1.5 rounded-full text-xs font-bold hover:bg-indigo-700 hover:text-white flex items-center justify-center gap-1 transition-all border border-indigo-400/50"
          >
            <LogOut class="w-3 h-3" />
            通常モードに戻る
          </button>
          <button
            @click="importSharedSchedule"
            class="flex-1 sm:flex-none bg-white text-indigo-700 px-3 py-1.5 rounded-full text-xs font-bold hover:bg-indigo-50 flex items-center justify-center gap-1 shadow-sm transition-all"
          >
            <Import class="w-3 h-3" />
            自分の予定として保存
          </button>
        </div>
      </div>

      <header
        class="flex-none bg-white border-b border-gray-200 shadow-sm z-30"
      >
        <div
          class="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center gap-2"
        >
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <a
              href="#/"
              class="p-1.5 -ml-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
              title="一覧に戻る"
            >
              <Home class="w-5 h-5" />
            </a>
            <h1
              class="text-lg font-bold flex items-center gap-2 text-gray-900 truncate"
            >
              <Calendar class="w-5 h-5 text-indigo-600 flex-shrink-0" />
              <span class="truncate">{{ eventData.title }}</span>
            </h1>
          </div>

          <!-- PC用メニュー (md以上で表示) -->
          <div class="hidden md:flex items-center gap-2">
            <div class="flex bg-gray-100 rounded-lg p-1 mr-1">
              <button
                @click="viewMode = 'grid'"
                :class="`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`"
                title="タイムテーブル表示"
              >
                <Grid class="w-4 h-4" />
              </button>
              <button
                @click="viewMode = 'list'"
                :class="`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`"
                title="リスト表示"
              >
                <List class="w-4 h-4" />
              </button>
            </div>

            <!-- 共有モード時はシェアボタンなどを隠す（または無効化） -->
            <template v-if="!isSharedMode">
              <button
                @click="handleCopyLink"
                :class="`flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold transition-all border ${copied ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`"
                title="リンクをコピー"
              >
                <Check v-if="copied" class="w-4 h-4" />
                <LinkIcon v-else class="w-4 h-4" />
              </button>

              <button
                @click="handleTwitterShare"
                class="flex items-center justify-center px-3 py-2 rounded-full text-sm font-bold transition-all bg-black text-white border border-black hover:bg-gray-800 shadow-sm gap-1.5"
                title="X(Twitter)でポスト"
              >
                <Twitter class="w-4 h-4" />
                <span>ポスト</span>
              </button>
            </template>

            <button
              v-if="viewMode === 'grid'"
              @click="showOnlyFavorites = !showOnlyFavorites"
              :class="`flex items-center justify-center px-4 py-2 rounded-full text-sm font-bold transition-all gap-2 ${showOnlyFavorites ? 'bg-pink-500 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`"
              title="フィルター切り替え"
            >
              <Heart
                :class="`w-4 h-4 ${showOnlyFavorites ? 'fill-current' : ''}`"
              />
              <span>{{ showOnlyFavorites ? "Myのみ" : "全て" }}</span>
            </button>
          </div>

          <!-- スマホ用メニューボタン (md未満で表示) -->
          <button
            class="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-full"
            @click="isMenuOpen = true"
          >
            <Menu class="w-6 h-6" />
          </button>
        </div>
      </header>

      <!-- スマホ用メニューモーダル -->
      <transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isMenuOpen"
          class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm md:hidden"
          @click="isMenuOpen = false"
        >
          <div
            class="absolute right-0 top-0 bottom-0 w-72 bg-white shadow-2xl p-4 overflow-y-auto"
            @click.stop
          >
            <div class="flex justify-between items-center mb-6">
              <h2 class="text-lg font-bold text-gray-800">Menu</h2>
              <button
                @click="isMenuOpen = false"
                class="p-2 text-gray-500 hover:bg-gray-100 rounded-full"
              >
                <X class="w-6 h-6" />
              </button>
            </div>

            <div class="space-y-6">
              <!-- 共有モード時のインポートボタン（スマホ用） -->
              <div v-if="isSharedMode">
                <div class="flex flex-col gap-2">
                  <button
                    @click="withCloseMenu(importSharedSchedule)"
                    class="w-full bg-indigo-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-md transition-all"
                  >
                    <Import class="w-5 h-5" />
                    自分の予定として保存
                  </button>
                  <button
                    @click="withCloseMenu(exitSharedMode)"
                    class="w-full bg-white text-gray-700 border border-gray-300 px-4 py-3 rounded-xl font-bold hover:bg-gray-50 flex items-center justify-center gap-2 transition-all"
                  >
                    <LogOut class="w-5 h-5" />
                    通常モードに戻る
                  </button>
                </div>
                <p class="text-xs text-gray-500 mt-2 text-center">
                  現在は共有モード（閲覧専用）です
                </p>
              </div>

              <!-- セクション: 表示切り替え -->
              <div>
                <h3
                  class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2"
                >
                  表示モード
                </h3>
                <div class="flex bg-gray-100 rounded-lg p-1">
                  <button
                    @click="withCloseMenu(() => (viewMode = 'grid'))"
                    class="flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold transition-all"
                    :class="
                      viewMode === 'grid'
                        ? 'bg-white shadow-sm text-indigo-600'
                        : 'text-gray-500'
                    "
                  >
                    <Grid class="w-4 h-4" />
                    タイムテーブル
                  </button>
                  <button
                    @click="withCloseMenu(() => (viewMode = 'list'))"
                    class="flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold transition-all"
                    :class="
                      viewMode === 'list'
                        ? 'bg-white shadow-sm text-indigo-600'
                        : 'text-gray-500'
                    "
                  >
                    <List class="w-4 h-4" />
                    リスト
                  </button>
                </div>
              </div>

              <!-- セクション: フィルター -->
              <div v-if="viewMode === 'grid'">
                <h3
                  class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2"
                >
                  フィルター
                </h3>
                <button
                  @click="
                    withCloseMenu(
                      () => (showOnlyFavorites = !showOnlyFavorites),
                    )
                  "
                  :class="`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold transition-all ${showOnlyFavorites ? 'bg-pink-500 text-white shadow-md' : 'bg-gray-100 text-gray-700'}`"
                >
                  <span class="flex items-center gap-2">
                    <Heart
                      :class="`w-5 h-5 ${showOnlyFavorites ? 'fill-current' : ''}`"
                    />
                    My予定のみ表示
                  </span>
                  <div
                    class="w-10 h-6 bg-black/10 rounded-full relative transition-colors"
                  >
                    <div
                      class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform"
                      :class="showOnlyFavorites ? 'translate-x-4' : ''"
                    ></div>
                  </div>
                </button>
              </div>

              <!-- セクション: シェア -->
              <div v-if="!isSharedMode">
                <h3
                  class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2"
                >
                  シェア・共有
                </h3>
                <div class="grid grid-cols-2 gap-3">
                  <button
                    @click="withCloseMenu(handleCopyLink)"
                    class="flex flex-col items-center justify-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <div
                      class="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-gray-600"
                    >
                      <Check v-if="copied" class="w-5 h-5 text-green-500" />
                      <LinkIcon v-else class="w-5 h-5" />
                    </div>
                    <span class="text-xs font-bold text-gray-600"
                      >リンクコピー</span
                    >
                  </button>
                  <button
                    @click="withCloseMenu(handleTwitterShare)"
                    class="flex flex-col items-center justify-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <div
                      class="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center shadow-sm"
                    >
                      <Twitter class="w-5 h-5" />
                    </div>
                    <span class="text-xs font-bold text-gray-600"
                      >Xでポスト</span
                    >
                  </button>
                </div>
              </div>

              <!-- セクション: その他 -->
              <div class="pt-4 border-t border-gray-100">
                <a
                  href="#/"
                  class="flex items-center gap-3 p-3 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors font-medium"
                >
                  <Home class="w-5 h-5" />
                  イベント一覧に戻る
                </a>
              </div>
            </div>
          </div>
        </div>
      </transition>

      <!-- Content Area -->
      <div
        v-if="viewMode === 'list'"
        class="flex-1 overflow-y-auto bg-gray-50 p-4"
      >
        <div class="max-w-2xl mx-auto">
          <h2
            class="text-xl font-bold mb-6 flex items-center gap-2 text-gray-800"
          >
            <Heart class="w-6 h-6 fill-pink-500 text-pink-500" />My
            タイムテーブル
          </h2>

          <div
            v-if="sortedFavorites.length === 0"
            class="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100"
          >
            <p class="text-gray-500 font-medium mb-4">
              スケジュールが登録されていません
            </p>
            <button
              @click="viewMode = 'grid'"
              class="text-indigo-600 font-bold hover:underline"
            >
              タイムテーブルから探す
            </button>
          </div>

          <div v-else class="space-y-4">
            <div
              v-for="event in sortedFavorites"
              :key="event.id"
              class="bg-white rounded-xl p-4 shadow-sm border-l-4 relative"
              :class="event.color.replace('bg-', 'border-').split(' ')[0]"
            >
              <div class="flex justify-between items-start mb-2">
                <span
                  class="text-indigo-600 font-bold font-mono bg-indigo-50 px-2 py-1 rounded text-sm"
                  >{{ event.startTime }} - {{ event.endTime }}</span
                >
                <span
                  class="text-gray-500 text-xs font-bold bg-gray-100 px-2 py-1 rounded-full"
                  >{{ getStageName(event.stageId) }}</span
                >
              </div>
              <h3 class="text-lg font-bold text-gray-800 mb-1">
                {{ event.title }}
              </h3>
              <p class="text-gray-600 text-sm">{{ event.artist }}</p>
              <button
                v-if="!isSharedMode"
                @click="toggleFavorite(event.id)"
                class="absolute bottom-4 right-4 text-xs font-bold text-gray-400 hover:text-red-500 flex items-center gap-1"
              >
                <Heart class="w-3.5 h-3.5 fill-current" />削除
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="flex-1 overflow-hidden relative flex flex-row">
        <!-- Main Timeline (Scrollable) -->
        <div
          class="flex-1 overflow-auto relative bg-white touch-pan-x touch-pan-y"
        >
          <div class="flex min-w-[800px] md:min-w-full relative">
            <!-- Left Axis -->
            <div
              class="sticky left-0 z-20 w-14 bg-gray-50 border-r border-gray-200 flex-none shadow-[2px_0_5px_rgba(0,0,0,0.05)]"
            >
              <div
                class="h-10 border-b border-gray-200 bg-gray-100 sticky top-0 z-30"
              ></div>
              <!-- グループヘッダー分の高さ調整 -->
              <div
                v-if="groupedVisibleStages.some((g) => g.name)"
                class="h-6 bg-gray-50 border-b border-gray-200 sticky top-10 z-30"
              ></div>

              <div
                class="relative"
                :style="{
                  height: `${(endHour - startHour) * 60 * PIXELS_PER_MINUTE}px`,
                }"
              >
                <div
                  v-for="time in timeSlots"
                  :key="time"
                  class="absolute w-full text-center text-[10px] text-gray-400 font-semibold border-t border-gray-200"
                  :style="{
                    top: `${(timeToMinutes(time) - startMinutes) * PIXELS_PER_MINUTE}px`,
                  }"
                >
                  <span class="-top-2.5 relative bg-gray-50 px-1">{{
                    time
                  }}</span>
                </div>
              </div>
            </div>

            <!-- Stage & Events Area -->
            <div class="flex-1 relative">
              <!-- Sticky Header (2段構成) -->
              <div
                class="sticky top-0 z-20 bg-gray-50/95 backdrop-blur shadow-sm border-b border-gray-200 flex"
              >
                <!-- グループごとのブロック -->
                <div
                  v-for="group in groupedVisibleStages"
                  :key="group.name + group.stages[0]?.id"
                  class="flex flex-col border-r border-gray-200 last:border-r-0"
                  :class="group.name ? 'border-r' : ''"
                >
                  <!-- グループ名 (1段目) -->
                  <div
                    v-if="group.name"
                    class="h-6 text-center text-xs font-bold text-gray-700 bg-gray-100/80 border-b border-gray-200 flex items-center justify-center w-full truncate px-1"
                  >
                    {{ group.name }}
                  </div>
                  <div
                    v-else
                    class="h-6 bg-gray-50/0 border-b border-gray-200"
                  ></div>

                  <!-- ステージ名 (2段目) -->
                  <div class="flex h-10">
                    <div
                      v-for="stage in group.stages"
                      :key="stage.id"
                      @click="toggleStageVisibility(stage.id)"
                      class="flex-1 min-w-[180px] flex items-center justify-center font-bold text-xs text-gray-600 border-r border-gray-200 last:border-r-0 cursor-pointer hover:bg-gray-100 group relative transition-colors select-none"
                      title="クリックして非表示"
                    >
                      {{ stage.name }}
                      <EyeOff
                        class="w-3.5 h-3.5 absolute right-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Grid -->
              <div
                class="relative flex"
                :style="{
                  height: `${(endHour - startHour) * 60 * PIXELS_PER_MINUTE}px`,
                }"
              >
                <!-- Grid Lines -->
                <div class="absolute inset-0 z-0 pointer-events-none">
                  <div
                    v-for="time in timeSlots"
                    :key="`grid-${time}`"
                    class="absolute w-full border-t border-gray-100 border-dashed"
                    :style="{
                      top: `${(timeToMinutes(time) - startMinutes) * PIXELS_PER_MINUTE}px`,
                    }"
                  ></div>
                </div>

                <!-- Current Time -->
                <div
                  v-if="currentPos !== null"
                  class="absolute z-10 w-full border-t-2 border-red-500 pointer-events-none opacity-70"
                  :style="{ top: `${currentPos}px` }"
                >
                  <div
                    class="absolute -ml-1 w-2 h-2 bg-red-500 rounded-full"
                  ></div>
                </div>

                <!-- Blocked Bands -->
                <template v-if="!showOnlyFavorites">
                  <div
                    v-for="fav in favoriteEvents"
                    :key="`band-${fav.id}`"
                    class="absolute w-full bg-gray-600/10 pointer-events-none z-0 border-y border-gray-600/20 mix-blend-multiply"
                    :style="{
                      top: `${(timeToMinutes(fav.startTime) - startMinutes) * PIXELS_PER_MINUTE}px`,
                      height: `${(timeToMinutes(fav.endTime) - timeToMinutes(fav.startTime)) * PIXELS_PER_MINUTE}px`,
                    }"
                  ></div>
                </template>

                <!-- Event Columns: Group Loop -> Stage Loop -->
                <div
                  v-for="group in groupedVisibleStages"
                  :key="group.name + group.stages[0]?.id"
                  class="flex border-r border-gray-200 last:border-r-0"
                >
                  <div
                    v-for="stage in group.stages"
                    :key="stage.id"
                    class="flex-1 min-w-[180px] relative border-r border-gray-100 group last:border-r-0"
                  >
                    <div
                      v-for="event in displayedEvents.filter(
                        (e) => e.stageId === stage.id,
                      )"
                      :key="event.id"
                      @click="!isBlocked(event) && toggleFavorite(event.id)"
                      :class="[
                        'absolute inset-x-1 rounded-md p-2 text-xs flex flex-col justify-start transition-all overflow-hidden',
                        event.color,
                        favorites.includes(event.id)
                          ? 'z-10 ring-2 ring-pink-500 shadow-md bg-pink-100 border-pink-500'
                          : isBlocked(event)
                            ? 'z-0 opacity-40 grayscale pointer-events-none bg-gray-200 border-gray-300'
                            : isSharedMode // 共有モード時はカーソルを変更
                              ? 'shadow-sm border-l-4 opacity-90 cursor-default'
                              : 'shadow-sm border-l-4 opacity-90 hover:opacity-100 hover:z-20 cursor-pointer',
                      ]"
                      :style="{
                        top: `${(timeToMinutes(event.startTime) - startMinutes) * PIXELS_PER_MINUTE}px`,
                        height: `${(timeToMinutes(event.endTime) - timeToMinutes(event.startTime)) * PIXELS_PER_MINUTE - 2}px`,
                      }"
                    >
                      <div
                        class="flex justify-between items-start pointer-events-none font-bold leading-tight mb-0.5"
                      >
                        <span class="line-clamp-2">{{ event.title }}</span>
                        <Heart
                          v-if="favorites.includes(event.id)"
                          class="w-3.5 h-3.5 fill-pink-500 text-pink-500 flex-shrink-0"
                        />
                      </div>
                      <div class="truncate mb-0.5 pointer-events-none">
                        {{ event.artist }}
                      </div>
                      <div
                        class="mt-auto text-[10px] flex items-center gap-1 pointer-events-none text-gray-500"
                      >
                        <Clock class="w-3 h-3" />{{ event.startTime }} -
                        {{ event.endTime }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Hidden Stages Sidebar (Right) -->
        <div
          v-if="hiddenStages.length > 0"
          class="flex-none w-10 border-l border-gray-200 bg-gray-100 flex flex-col items-center py-4 gap-3 z-30 shadow-inner overflow-y-auto"
        >
          <div
            v-for="stage in hiddenStages"
            :key="stage.id"
            @click="toggleStageVisibility(stage.id)"
            class="group cursor-pointer p-2 bg-white rounded-md shadow-sm border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 transition-all flex flex-col items-center gap-2"
            title="クリックして復帰"
          >
            <!-- 縦書き風の表示 (CSS writing-mode) -->
            <span
              class="text-xs font-bold text-gray-500 group-hover:text-indigo-600 [writing-mode:vertical-rl] tracking-widest"
              >{{ stage.name }}</span
            >
            <LogIn class="w-4 h-4 text-gray-300 group-hover:text-indigo-500" />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
