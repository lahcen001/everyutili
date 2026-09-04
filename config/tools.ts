import type { LucideIcon } from "lucide-react";
import {
  ImageIcon,
  FileImage,
  Shrink,
  Maximize,
  FileCode2,
  ArrowLeftRight,
  Binary,
  Star,
  QrCode,
  Pipette,
  Scissors,
  Images,
  FilePlus2,
  RotateCw,
  FileMinus2,
  FileArchive,
  AlignLeft,
  Braces,
  Link2,
  KeyRound,
  Fingerprint,
  Hash,
  Regex,
  FileType2,
  FileJson2,
  Type,
  Percent,
  Tag,
  HandCoins,
  Landmark,
  TrendingUp,
  ReceiptText,
  HeartPulse,
  ShieldCheck,
  CaseSensitive,
  GitCompareArrows,
  Cake,
  Ruler,
  Crop,
  EyeOff,
  Sparkles,
  Database,
  FileSpreadsheet,
  Minimize,
  Code2,
  Heading,
  Share2,
  ListFilter,
  Shapes,
  Video,
  Contrast,
  Proportions,
  Film,
  Mic,
  Laptop,
  PenTool,
  SlidersHorizontal,
  Stamp,
  LayoutGrid,
  VolumeX,
  Gauge,
} from "lucide-react";

export const CATEGORIES = [
  "media",
  "document",
  "developer",
  "financial",
] as const;

export type ToolCategory = (typeof CATEGORIES)[number];

/**
 * Structural category metadata only. Translatable label/description strings
 * live in messages/[locale].json under `categories.<slug>` instead.
 */
export interface CategoryMeta {
  slug: ToolCategory;
}

export const CATEGORY_META: Record<ToolCategory, CategoryMeta> = {
  media: { slug: "media" },
  document: { slug: "document" },
  developer: { slug: "developer" },
  financial: { slug: "financial" },
};

export interface HowToStep {
  name: string;
  text: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ComparisonRow {
  label: string;
  values: string[];
}

export interface ComparisonTableData {
  columns: string[];
  rows: ComparisonRow[];
}

/**
 * Structural / English-source-of-truth fields only. All translatable copy
 * (seoTitle, metaDescription, h1, subheading, keywords, howTo, faq,
 * comparisonTable) lives in messages/[locale].json under `tools.<slug>`
 * instead — see lib/tool-content.ts.
 *
 * `name`/`shortName` are a deliberate exception: they stay here as
 * English-only internal/fallback labels (used e.g. in SiteFooter columns
 * and ToolGrid's slug-based search fallback), not fully localized. This is
 * an explicit scoping choice, not an oversight.
 *
 * Deliberately excludes the tool's actual component/loader: that lives in
 * config/tool-components.ts instead, imported only by the tool detail route.
 * Every other consumer of this file (BentoToolGrid, RecentToolsShelf,
 * CommandMenu, SiteHeader, ToolGrid, ...) only ever needs this lightweight
 * metadata, so keeping the two separate stops those client bundles from
 * pulling in every tool's dynamic-import graph (some of which — pdf-lib,
 * pdfjs-dist, @monaco-editor/react — are large).
 */
export interface ToolConfig {
  slug: string;
  category: ToolCategory;
  icon: LucideIcon;
  name: string;
  shortName: string;
  relatedSlugs: string[];
  /**
   * Set to false only for tools whose initial render is inherently
   * non-deterministic (e.g. generates random values on mount), to avoid
   * server/client hydration mismatches. Defaults to true (SSR enabled).
   */
  ssr?: boolean;
  priority: number;
  changeFrequency: "daily" | "weekly" | "monthly";
}

export const TOOLS: ToolConfig[] = [
  {
    slug: "jpg-to-png",
    category: "media",
    icon: ImageIcon,
    name: "JPG to PNG Converter",
    shortName: "JPG to PNG",
    relatedSlugs: ["merge-pdf", "json-formatter"],
    priority: 1,
    changeFrequency: "weekly",
  },
  {
    slug: "merge-pdf",
    category: "document",
    icon: FilePlus2,
    name: "Merge PDF Files",
    shortName: "Merge PDF",
    relatedSlugs: ["jpg-to-png", "json-formatter"],
    priority: 1,
    changeFrequency: "weekly",
  },
  {
    slug: "json-formatter",
    category: "developer",
    icon: Braces,
    name: "JSON Formatter & Validator",
    shortName: "JSON Formatter",
    relatedSlugs: ["jpg-to-png", "salary-to-hourly"],
    priority: 1,
    changeFrequency: "weekly",
  },
  {
    slug: "salary-to-hourly",
    category: "financial",
    icon: Landmark,
    name: "Salary to Hourly Calculator",
    shortName: "Salary to Hourly",
    relatedSlugs: ["json-formatter", "merge-pdf"],
    priority: 0.78,
    changeFrequency: "monthly",
  },

  // ---------------------------------------------------------------------
  // Media
  // ---------------------------------------------------------------------
  {
    slug: "heic-to-jpg",
    category: "media",
    icon: FileImage,
    name: "HEIC to JPG Converter",
    shortName: "HEIC to JPG",
    relatedSlugs: ["jpg-to-png", "image-compressor"],
    priority: 0.92,
    changeFrequency: "weekly",
  },
  {
    slug: "image-compressor",
    category: "media",
    icon: Shrink,
    name: "Image Compressor",
    shortName: "Image Compressor",
    relatedSlugs: ["image-resizer", "webp-converter"],
    priority: 0.94,
    changeFrequency: "weekly",
  },
  {
    slug: "image-resizer",
    category: "media",
    icon: Maximize,
    name: "Image Resizer",
    shortName: "Image Resizer",
    relatedSlugs: ["image-compressor", "favicon-generator"],
    priority: 0.84,
    changeFrequency: "weekly",
  },
  {
    slug: "webp-converter",
    category: "media",
    icon: FileCode2,
    name: "Image to WebP Converter",
    shortName: "WebP Converter",
    relatedSlugs: ["image-compressor", "png-to-jpg"],
    priority: 0.8,
    changeFrequency: "weekly",
  },
  {
    slug: "png-to-jpg",
    category: "media",
    icon: ArrowLeftRight,
    name: "PNG to JPG Converter",
    shortName: "PNG to JPG",
    relatedSlugs: ["jpg-to-png", "image-compressor"],
    priority: 0.96,
    changeFrequency: "weekly",
  },
  {
    slug: "svg-to-png",
    category: "media",
    icon: Shapes,
    name: "SVG to PNG Converter",
    shortName: "SVG to PNG",
    relatedSlugs: ["svg-optimizer", "png-to-jpg"],
    priority: 0.82,
    changeFrequency: "weekly",
  },
  {
    slug: "svg-to-jpg",
    category: "media",
    icon: Shapes,
    name: "SVG to JPG Converter",
    shortName: "SVG to JPG",
    relatedSlugs: ["svg-to-png", "jpg-to-png"],
    priority: 0.74,
    changeFrequency: "weekly",
  },
  {
    slug: "svg-to-webp",
    category: "media",
    icon: Shapes,
    name: "SVG to WebP Converter",
    shortName: "SVG to WebP",
    relatedSlugs: ["svg-to-png", "webp-converter"],
    priority: 0.7,
    changeFrequency: "weekly",
  },
  {
    slug: "png-to-webp",
    category: "media",
    icon: ArrowLeftRight,
    name: "PNG to WebP Converter",
    shortName: "PNG to WebP",
    relatedSlugs: ["webp-converter", "jpg-to-png"],
    priority: 0.78,
    changeFrequency: "weekly",
  },
  {
    slug: "webp-to-png",
    category: "media",
    icon: ArrowLeftRight,
    name: "WebP to PNG Converter",
    shortName: "WebP to PNG",
    relatedSlugs: ["png-to-jpg", "webp-converter"],
    priority: 0.78,
    changeFrequency: "weekly",
  },
  {
    slug: "webp-to-jpg",
    category: "media",
    icon: ArrowLeftRight,
    name: "WebP to JPG Converter",
    shortName: "WebP to JPG",
    relatedSlugs: ["png-to-jpg", "webp-converter"],
    priority: 0.76,
    changeFrequency: "weekly",
  },
  {
    slug: "jpg-to-webp",
    category: "media",
    icon: ArrowLeftRight,
    name: "JPG to WebP Converter",
    shortName: "JPG to WebP",
    relatedSlugs: ["webp-converter", "png-to-jpg"],
    priority: 0.76,
    changeFrequency: "weekly",
  },
  {
    slug: "base64-image-encoder",
    category: "media",
    icon: Binary,
    name: "Base64 Image Encoder",
    shortName: "Base64 Image Encoder",
    relatedSlugs: ["qr-code-generator", "json-formatter"],
    priority: 0.65,
    changeFrequency: "monthly",
  },
  {
    slug: "favicon-generator",
    category: "media",
    icon: Star,
    name: "Favicon Generator",
    shortName: "Favicon Generator",
    relatedSlugs: ["image-resizer", "qr-code-generator"],
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    slug: "qr-code-generator",
    category: "media",
    icon: QrCode,
    name: "QR Code Generator",
    shortName: "QR Code Generator",
    relatedSlugs: ["base64-image-encoder", "favicon-generator"],
    priority: 0.98,
    changeFrequency: "weekly",
  },
  {
    slug: "color-picker",
    category: "media",
    icon: Pipette,
    name: "Image Color Picker",
    shortName: "Color Picker",
    relatedSlugs: ["qr-code-generator", "favicon-generator"],
    priority: 0.68,
    changeFrequency: "monthly",
  },

  // ---------------------------------------------------------------------
  // Document
  // ---------------------------------------------------------------------
  {
    slug: "split-pdf",
    category: "document",
    icon: Scissors,
    name: "Split PDF Files",
    shortName: "Split PDF",
    relatedSlugs: ["merge-pdf", "delete-pdf-pages"],
    priority: 0.94,
    changeFrequency: "weekly",
  },
  {
    slug: "pdf-to-images",
    category: "document",
    icon: FileImage,
    name: "PDF to Images Converter",
    shortName: "PDF to Images",
    relatedSlugs: ["images-to-pdf", "split-pdf"],
    priority: 0.88,
    changeFrequency: "weekly",
  },
  {
    slug: "images-to-pdf",
    category: "document",
    icon: Images,
    name: "Images to PDF Converter",
    shortName: "Images to PDF",
    relatedSlugs: ["pdf-to-images", "merge-pdf"],
    priority: 0.86,
    changeFrequency: "weekly",
  },
  {
    slug: "rotate-pdf",
    category: "document",
    icon: RotateCw,
    name: "Rotate PDF Pages",
    shortName: "Rotate PDF",
    relatedSlugs: ["split-pdf", "delete-pdf-pages"],
    priority: 0.76,
    changeFrequency: "weekly",
  },
  {
    slug: "delete-pdf-pages",
    category: "document",
    icon: FileMinus2,
    name: "Delete PDF Pages",
    shortName: "Delete PDF Pages",
    relatedSlugs: ["split-pdf", "rotate-pdf"],
    priority: 0.78,
    changeFrequency: "weekly",
  },
  {
    slug: "compress-pdf",
    category: "document",
    icon: FileArchive,
    name: "Compress PDF Files",
    shortName: "Compress PDF",
    relatedSlugs: ["merge-pdf", "split-pdf"],
    priority: 0.9,
    changeFrequency: "weekly",
  },
  {
    slug: "word-counter",
    category: "document",
    icon: AlignLeft,
    name: "Word & Character Counter",
    shortName: "Word Counter",
    relatedSlugs: ["markdown-previewer", "lorem-ipsum-generator"],
    priority: 0.82,
    changeFrequency: "monthly",
  },

  // ---------------------------------------------------------------------
  // Developer
  // ---------------------------------------------------------------------
  {
    slug: "base64-encoder-decoder",
    category: "developer",
    icon: Binary,
    name: "Base64 Encoder / Decoder",
    shortName: "Base64 Encoder",
    relatedSlugs: ["url-encoder-decoder", "jwt-decoder"],
    priority: 0.92,
    changeFrequency: "weekly",
  },
  {
    slug: "url-encoder-decoder",
    category: "developer",
    icon: Link2,
    name: "URL Encoder / Decoder",
    shortName: "URL Encoder",
    relatedSlugs: ["base64-encoder-decoder", "jwt-decoder"],
    priority: 0.83,
    changeFrequency: "weekly",
  },
  {
    slug: "jwt-decoder",
    category: "developer",
    icon: KeyRound,
    name: "JWT Decoder",
    shortName: "JWT Decoder",
    relatedSlugs: ["base64-encoder-decoder", "hash-generator"],
    ssr: false,
    priority: 0.87,
    changeFrequency: "weekly",
  },
  {
    slug: "uuid-generator",
    category: "developer",
    icon: Fingerprint,
    name: "UUID Generator",
    shortName: "UUID Generator",
    relatedSlugs: ["hash-generator", "jwt-decoder"],
    ssr: false,
    priority: 0.9,
    changeFrequency: "weekly",
  },
  {
    slug: "hash-generator",
    category: "developer",
    icon: Hash,
    name: "Hash Generator (SHA-1/256/384/512)",
    shortName: "Hash Generator",
    relatedSlugs: ["uuid-generator", "jwt-decoder"],
    priority: 0.9,
    changeFrequency: "weekly",
  },
  {
    slug: "regex-tester",
    category: "developer",
    icon: Regex,
    name: "Regex Tester",
    shortName: "Regex Tester",
    relatedSlugs: ["json-formatter", "csv-to-json"],
    priority: 0.84,
    changeFrequency: "weekly",
  },
  {
    slug: "markdown-previewer",
    category: "developer",
    icon: FileType2,
    name: "Markdown Previewer",
    shortName: "Markdown Previewer",
    relatedSlugs: ["word-counter", "json-formatter"],
    ssr: false,
    priority: 0.78,
    changeFrequency: "weekly",
  },
  {
    slug: "csv-to-json",
    category: "developer",
    icon: FileJson2,
    name: "CSV to JSON Converter",
    shortName: "CSV to JSON",
    relatedSlugs: ["json-formatter", "regex-tester"],
    priority: 0.79,
    changeFrequency: "weekly",
  },
  {
    slug: "lorem-ipsum-generator",
    category: "developer",
    icon: Type,
    name: "Lorem Ipsum Generator",
    shortName: "Lorem Ipsum",
    relatedSlugs: ["word-counter", "markdown-previewer"],
    ssr: false,
    priority: 0.62,
    changeFrequency: "monthly",
  },

  // ---------------------------------------------------------------------
  // Financial
  // ---------------------------------------------------------------------
  {
    slug: "percentage-calculator",
    category: "financial",
    icon: Percent,
    name: "Percentage Calculator",
    shortName: "Percentage Calculator",
    relatedSlugs: ["discount-calculator", "sales-tax-calculator"],
    priority: 0.99,
    changeFrequency: "monthly",
  },
  {
    slug: "discount-calculator",
    category: "financial",
    icon: Tag,
    name: "Discount Calculator",
    shortName: "Discount Calculator",
    relatedSlugs: ["percentage-calculator", "sales-tax-calculator"],
    priority: 0.92,
    changeFrequency: "monthly",
  },
  {
    slug: "tip-calculator",
    category: "financial",
    icon: HandCoins,
    name: "Tip Calculator",
    shortName: "Tip Calculator",
    relatedSlugs: ["percentage-calculator", "sales-tax-calculator"],
    priority: 0.95,
    changeFrequency: "monthly",
  },
  {
    slug: "loan-emi-calculator",
    category: "financial",
    icon: Landmark,
    name: "Loan EMI Calculator",
    shortName: "Loan EMI Calculator",
    relatedSlugs: ["compound-interest-calculator", "salary-to-hourly"],
    priority: 0.83,
    changeFrequency: "monthly",
  },
  {
    slug: "compound-interest-calculator",
    category: "financial",
    icon: TrendingUp,
    name: "Compound Interest Calculator",
    shortName: "Compound Interest",
    relatedSlugs: ["loan-emi-calculator", "percentage-calculator"],
    priority: 0.72,
    changeFrequency: "monthly",
  },
  {
    slug: "sales-tax-calculator",
    category: "financial",
    icon: ReceiptText,
    name: "Sales Tax Calculator",
    shortName: "Sales Tax Calculator",
    relatedSlugs: ["discount-calculator", "tip-calculator"],
    priority: 0.76,
    changeFrequency: "monthly",
  },
  {
    slug: "bmi-calculator",
    category: "financial",
    icon: HeartPulse,
    name: "BMI Calculator",
    shortName: "BMI Calculator",
    relatedSlugs: ["percentage-calculator", "salary-to-hourly"],
    priority: 0.93,
    changeFrequency: "monthly",
  },
  {
    slug: "age-calculator",
    category: "financial",
    icon: Cake,
    name: "Age Calculator",
    shortName: "Age Calculator",
    relatedSlugs: ["bmi-calculator", "percentage-calculator"],
    priority: 0.88,
    changeFrequency: "monthly",
  },
  {
    slug: "unit-converter",
    category: "financial",
    icon: Ruler,
    name: "Unit Converter",
    shortName: "Unit Converter",
    relatedSlugs: ["percentage-calculator", "bmi-calculator"],
    priority: 0.87,
    changeFrequency: "monthly",
  },

  // ---------------------------------------------------------------------
  // Developer (new)
  // ---------------------------------------------------------------------
  {
    slug: "password-generator",
    category: "developer",
    icon: ShieldCheck,
    name: "Password Generator",
    shortName: "Password Generator",
    relatedSlugs: ["hash-generator", "uuid-generator"],
    ssr: false,
    priority: 0.95,
    changeFrequency: "weekly",
  },
  {
    slug: "text-case-converter",
    category: "developer",
    icon: CaseSensitive,
    name: "Text Case Converter",
    shortName: "Case Converter",
    relatedSlugs: ["word-counter", "lorem-ipsum-generator"],
    priority: 0.86,
    changeFrequency: "weekly",
  },
  {
    slug: "text-diff-checker",
    category: "developer",
    icon: GitCompareArrows,
    name: "Text Diff Checker",
    shortName: "Diff Checker",
    relatedSlugs: ["json-formatter", "text-case-converter"],
    priority: 0.81,
    changeFrequency: "weekly",
  },

  // ---------------------------------------------------------------------
  // Media (new)
  // ---------------------------------------------------------------------
  {
    slug: "image-cropper",
    category: "media",
    icon: Crop,
    name: "Image Cropper",
    shortName: "Image Cropper",
    relatedSlugs: ["image-resizer", "image-compressor"],
    priority: 0.89,
    changeFrequency: "weekly",
  },

  // ---------------------------------------------------------------------
  // Document (new)
  // ---------------------------------------------------------------------
  {
    slug: "pdf-page-numberer",
    category: "document",
    icon: Hash,
    name: "PDF Page Numberer",
    shortName: "Page Numberer",
    relatedSlugs: ["merge-pdf", "rotate-pdf"],
    priority: 0.73,
    changeFrequency: "weekly",
  },

  // ---------------------------------------------------------------------
  // Privacy & Security (new)
  // ---------------------------------------------------------------------
  {
    slug: "exif-stripper",
    category: "media",
    icon: EyeOff,
    name: "EXIF & GPS Metadata Remover",
    shortName: "EXIF Remover",
    relatedSlugs: ["image-compressor", "image-cropper"],
    priority: 0.85,
    changeFrequency: "weekly",
  },
  {
    slug: "zero-width-remover",
    category: "developer",
    icon: Sparkles,
    name: "Zero-Width Space & Invisible Character Cleaner",
    shortName: "Invisible Char Cleaner",
    relatedSlugs: ["text-diff-checker", "html-entity-encoder"],
    priority: 0.66,
    changeFrequency: "weekly",
  },
  {
    slug: "hmac-generator",
    category: "developer",
    icon: KeyRound,
    name: "HMAC Keyed-Hash Generator",
    shortName: "HMAC Generator",
    relatedSlugs: ["hash-generator", "password-generator"],
    priority: 0.72,
    changeFrequency: "weekly",
  },

  // ---------------------------------------------------------------------
  // Developer & Code Utilities (new)
  // ---------------------------------------------------------------------
  {
    slug: "json-to-typescript",
    category: "developer",
    icon: Braces,
    name: "JSON to TypeScript & Zod Schema",
    shortName: "JSON to TS",
    relatedSlugs: ["json-formatter", "json-to-yaml"],
    priority: 0.83,
    changeFrequency: "weekly",
  },
  {
    slug: "json-to-yaml",
    category: "developer",
    icon: FileCode2,
    name: "JSON ↔ YAML Converter",
    shortName: "JSON ↔ YAML",
    relatedSlugs: ["json-formatter", "json-to-typescript"],
    priority: 0.8,
    changeFrequency: "weekly",
  },
  {
    slug: "sql-formatter",
    category: "developer",
    icon: Database,
    name: "SQL Query Formatter",
    shortName: "SQL Formatter",
    relatedSlugs: ["json-formatter", "code-minifier"],
    priority: 0.78,
    changeFrequency: "weekly",
  },
  {
    slug: "json-to-csv",
    category: "developer",
    icon: FileSpreadsheet,
    name: "JSON to CSV Converter",
    shortName: "JSON to CSV",
    relatedSlugs: ["json-formatter", "csv-to-json"],
    priority: 0.75,
    changeFrequency: "weekly",
  },
  {
    slug: "code-minifier",
    category: "developer",
    icon: Minimize,
    name: "HTML & CSS Minifier",
    shortName: "Code Minifier",
    relatedSlugs: ["sql-formatter", "json-formatter"],
    priority: 0.74,
    changeFrequency: "weekly",
  },
  {
    slug: "html-entity-encoder",
    category: "developer",
    icon: Code2,
    name: "HTML Entity Encoder / Decoder",
    shortName: "HTML Entity Encoder",
    relatedSlugs: ["url-encoder-decoder", "base64-encoder-decoder"],
    priority: 0.71,
    changeFrequency: "weekly",
  },

  // ---------------------------------------------------------------------
  // Content Creators & SEO Tools (new)
  // ---------------------------------------------------------------------
  {
    slug: "title-case-converter",
    category: "developer",
    icon: Heading,
    name: "Title Case & Headline Capitalizer",
    shortName: "Title Case Converter",
    relatedSlugs: ["text-case-converter", "url-slug-generator"],
    priority: 0.77,
    changeFrequency: "weekly",
  },
  {
    slug: "url-slug-generator",
    category: "developer",
    icon: Link2,
    name: "SEO URL Slug Generator",
    shortName: "Slug Generator",
    relatedSlugs: ["title-case-converter", "opengraph-generator"],
    priority: 0.82,
    changeFrequency: "weekly",
  },
  {
    slug: "opengraph-generator",
    category: "developer",
    icon: Share2,
    name: "OpenGraph & Meta Tag Generator",
    shortName: "OpenGraph Generator",
    relatedSlugs: ["url-slug-generator", "title-case-converter"],
    priority: 0.86,
    changeFrequency: "weekly",
  },
  {
    slug: "duplicate-line-remover",
    category: "developer",
    icon: ListFilter,
    name: "Duplicate Line Remover & List Sorter",
    shortName: "Duplicate Line Remover",
    relatedSlugs: ["text-case-converter", "word-counter"],
    priority: 0.7,
    changeFrequency: "weekly",
  },

  // ---------------------------------------------------------------------
  // Media & Design Utilities (new)
  // ---------------------------------------------------------------------
  {
    slug: "svg-optimizer",
    category: "media",
    icon: Shapes,
    name: "SVG Optimizer & Path Cleaner",
    shortName: "SVG Optimizer",
    relatedSlugs: ["image-compressor", "code-minifier"],
    priority: 0.76,
    changeFrequency: "weekly",
  },
  {
    slug: "screen-recorder",
    category: "media",
    icon: Video,
    name: "In-Browser Screen & Audio Recorder",
    shortName: "Screen Recorder",
    relatedSlugs: ["image-cropper", "image-compressor"],
    ssr: false,
    priority: 0.81,
    changeFrequency: "weekly",
  },
  {
    slug: "wcag-contrast-checker",
    category: "media",
    icon: Contrast,
    name: "WCAG Color Contrast Checker",
    shortName: "Contrast Checker",
    relatedSlugs: ["color-picker", "svg-optimizer"],
    priority: 0.73,
    changeFrequency: "weekly",
  },
  {
    slug: "aspect-ratio-calculator",
    category: "financial",
    icon: Proportions,
    name: "Aspect Ratio & Dimension Calculator",
    shortName: "Aspect Ratio Calculator",
    relatedSlugs: ["unit-converter", "image-resizer"],
    priority: 0.69,
    changeFrequency: "weekly",
  },

  // ---------------------------------------------------------------------
  // Media Capture & Creative Studio Suite
  // ---------------------------------------------------------------------
  {
    slug: "screen-studio",
    category: "media",
    icon: Video,
    name: "Screen & Webcam Studio Recorder",
    shortName: "Screen Studio",
    relatedSlugs: ["screen-recorder", "video-trimmer"],
    ssr: false,
    priority: 0.82,
    changeFrequency: "weekly",
  },
  {
    slug: "screen-to-gif",
    category: "media",
    icon: Film,
    name: "Screen to Animated GIF",
    shortName: "Screen to GIF",
    relatedSlugs: ["screen-studio", "video-to-gif"],
    ssr: false,
    priority: 0.75,
    changeFrequency: "weekly",
  },
  {
    slug: "audio-recorder",
    category: "media",
    icon: Mic,
    name: "Voice & Audio Memo Recorder",
    shortName: "Audio Recorder",
    relatedSlugs: ["screen-studio", "video-audio-remover"],
    ssr: false,
    priority: 0.74,
    changeFrequency: "weekly",
  },
  {
    slug: "screenshot-beautifier",
    category: "media",
    icon: Laptop,
    name: "Screenshot Beautifier & Frame Mockup",
    shortName: "Screenshot Beautifier",
    relatedSlugs: ["image-annotator", "image-cropper"],
    priority: 0.83,
    changeFrequency: "weekly",
  },
  {
    slug: "image-annotator",
    category: "media",
    icon: PenTool,
    name: "Image Annotator & Pixelate Redactor",
    shortName: "Image Annotator",
    relatedSlugs: ["screenshot-beautifier", "image-cropper"],
    priority: 0.83,
    changeFrequency: "weekly",
  },
  {
    slug: "image-filters",
    category: "media",
    icon: SlidersHorizontal,
    name: "Canvas Image Filters & Color Grading",
    shortName: "Image Filters",
    relatedSlugs: ["image-annotator", "image-compressor"],
    priority: 0.78,
    changeFrequency: "weekly",
  },
  {
    slug: "watermark-maker",
    category: "media",
    icon: Stamp,
    name: "Batch Image Watermarker",
    shortName: "Watermark Maker",
    relatedSlugs: ["image-collage", "image-compressor"],
    priority: 0.78,
    changeFrequency: "weekly",
  },
  {
    slug: "image-collage",
    category: "media",
    icon: LayoutGrid,
    name: "Collage Maker & Photo Grid",
    shortName: "Collage Maker",
    relatedSlugs: ["watermark-maker", "image-cropper"],
    priority: 0.77,
    changeFrequency: "weekly",
  },
  {
    slug: "video-trimmer",
    category: "media",
    icon: Scissors,
    name: "Video Trimmer & Cutter",
    shortName: "Video Trimmer",
    relatedSlugs: ["video-to-gif", "video-speed"],
    ssr: false,
    priority: 0.85,
    changeFrequency: "weekly",
  },
  {
    slug: "video-to-gif",
    category: "media",
    icon: Sparkles,
    name: "Video to GIF Converter",
    shortName: "Video to GIF",
    relatedSlugs: ["video-trimmer", "screen-to-gif"],
    ssr: false,
    priority: 0.8,
    changeFrequency: "weekly",
  },
  {
    slug: "video-audio-remover",
    category: "media",
    icon: VolumeX,
    name: "Video Muter & Audio Extractor",
    shortName: "Audio Remover",
    relatedSlugs: ["video-trimmer", "audio-recorder"],
    ssr: false,
    priority: 0.76,
    changeFrequency: "weekly",
  },
  {
    slug: "video-speed",
    category: "media",
    icon: Gauge,
    name: "Video Speed Controller (Slow-Mo & Fast)",
    shortName: "Video Speed",
    relatedSlugs: ["video-trimmer", "video-to-gif"],
    ssr: false,
    priority: 0.76,
    changeFrequency: "weekly",
  },
];

export function getToolBySlug(slug: string): ToolConfig | undefined {
  return TOOLS.find((tool) => tool.slug === slug);
}

/** Tools for a category, most-used-first (by editorial `priority`, descending). */
export function getToolsByCategory(category: ToolCategory): ToolConfig[] {
  return TOOLS.filter((tool) => tool.category === category).sort((a, b) => b.priority - a.priority);
}

export function getRelatedTools(tool: ToolConfig): ToolConfig[] {
  return tool.relatedSlugs
    .map((slug) => getToolBySlug(slug))
    .filter((t): t is ToolConfig => Boolean(t));
}
