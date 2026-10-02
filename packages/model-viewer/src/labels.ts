export type ModelViewerLabels = {
  attachMaterial: string
  resetView: string
  wireframe: string
  flatShading: string
  guides: string
  fullscreen: string
  exitFullscreen: string
  loading: string
  loadFailed: string
  materialMissing: string
  dropHint: string
  details: string
  view: string
  background: string
  white: string
  gray: string
  black: string
  lighting: string
  brightness: string
  file: string
  fileSize: string
  vertices: string
  faces: string
  objects: string
  materials: string
  dimensions: string
  none: string
}

export type ModelViewerLocale = "en" | "ko" | "ja" | "zh"

export const modelViewerLabels: Record<ModelViewerLocale, ModelViewerLabels> = {
  en: {
    attachMaterial: "Attach material",
    resetView: "Reset view",
    wireframe: "Wireframe",
    flatShading: "Flat shading",
    guides: "Grid and axes",
    fullscreen: "Fullscreen",
    exitFullscreen: "Exit fullscreen",
    loading: "Loading model",
    loadFailed: "Model unavailable",
    materialMissing: "No material file",
    dropHint: "Drop an MTL file and its textures here.",
    details: "Details",
    view: "View options",
    background: "Background",
    white: "White",
    gray: "Gray",
    black: "Black",
    lighting: "Lighting",
    brightness: "Brightness",
    file: "File",
    fileSize: "Size",
    vertices: "Vertices",
    faces: "Faces",
    objects: "Objects",
    materials: "Materials",
    dimensions: "Dimensions",
    none: "None",
  },
  ko: {
    attachMaterial: "재질 불러오기",
    resetView: "시점 초기화",
    wireframe: "와이어프레임",
    flatShading: "평면 셰이딩",
    guides: "격자와 축",
    fullscreen: "전체 화면",
    exitFullscreen: "전체 화면 해제",
    loading: "모델 불러오는 중",
    loadFailed: "모델 열기 실패",
    materialMissing: "재질 파일 없음",
    dropHint: "MTL 파일과 텍스처를 여기에 놓으세요.",
    details: "상세 정보",
    view: "보기 설정",
    background: "배경",
    white: "흰색",
    gray: "회색",
    black: "검은색",
    lighting: "조명",
    brightness: "밝기",
    file: "파일",
    fileSize: "크기",
    vertices: "정점",
    faces: "면",
    objects: "개체",
    materials: "재질",
    dimensions: "치수",
    none: "없음",
  },
  ja: {
    attachMaterial: "マテリアルを読み込む",
    resetView: "視点をリセット",
    wireframe: "ワイヤーフレーム",
    flatShading: "フラットシェーディング",
    guides: "グリッドと軸",
    fullscreen: "全画面表示",
    exitFullscreen: "全画面表示を終了",
    loading: "モデルを読み込み中",
    loadFailed: "モデルを開けません",
    materialMissing: "マテリアルファイルなし",
    dropHint: "MTL ファイルとテクスチャをここにドロップしてください。",
    details: "詳細",
    view: "表示設定",
    background: "背景",
    white: "白",
    gray: "グレー",
    black: "黒",
    lighting: "ライティング",
    brightness: "明るさ",
    file: "ファイル",
    fileSize: "サイズ",
    vertices: "頂点",
    faces: "面",
    objects: "オブジェクト",
    materials: "マテリアル",
    dimensions: "寸法",
    none: "なし",
  },
  zh: {
    attachMaterial: "加载材质",
    resetView: "重置视角",
    wireframe: "线框",
    flatShading: "平面着色",
    guides: "网格和坐标轴",
    fullscreen: "全屏",
    exitFullscreen: "退出全屏",
    loading: "正在加载模型",
    loadFailed: "无法打开模型",
    materialMissing: "无材质文件",
    dropHint: "将 MTL 文件及其纹理拖放到此处。",
    details: "详细信息",
    view: "视图设置",
    background: "背景",
    white: "白色",
    gray: "灰色",
    black: "黑色",
    lighting: "光照",
    brightness: "亮度",
    file: "文件",
    fileSize: "大小",
    vertices: "顶点",
    faces: "面",
    objects: "对象",
    materials: "材质",
    dimensions: "尺寸",
    none: "无",
  },
}

const LOCALES: ModelViewerLocale[] = ["en", "ko", "ja", "zh"]

export const viewerLocale = (language = ""): ModelViewerLocale =>
  LOCALES.find(code => language.startsWith(code)) ?? "en"
