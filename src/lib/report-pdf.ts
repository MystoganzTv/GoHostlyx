import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import type { DashboardView } from "@/lib/types";

type ShareReportPdfInput = {
  businessName: string;
  generatedAt: string;
  latestImportFileName?: string | null;
  view: DashboardView;
};

const pageWidth = 595.28;
const pageHeight = 841.89;
const pageMargin = 22;
const sheetInset = 16;
const sheetWidth = pageWidth - pageMargin * 2;
const sheetHeight = pageHeight - pageMargin * 2;
const contentX = pageMargin + sheetInset;
const contentY = pageMargin + sheetInset;
const contentWidth = sheetWidth - sheetInset * 2;
const contentTop = pageHeight - pageMargin - sheetInset;

const brandFontFiles = {
  regular: path.join(process.cwd(), "src/assets/fonts/Manrope-Variable.ttf"),
  semibold: path.join(process.cwd(), "src/assets/fonts/Manrope-Variable.ttf"),
  mono: path.join(process.cwd(), "src/assets/fonts/IBMPlexMono-Medium.ttf"),
} as const;

const brandFontDataPromise = Promise.all([
  readFile(brandFontFiles.regular),
  readFile(brandFontFiles.semibold),
  readFile(brandFontFiles.mono),
]);

type PdfFonts = {
  regular: PDFFont;
  semibold: PDFFont;
  mono: PDFFont;
};

function drawRect(
  page: PDFPage,
  options: {
    x: number;
    y: number;
    width: number;
    height: number;
    fill: ReturnType<typeof rgb>;
    border?: ReturnType<typeof rgb>;
    borderWidth?: number;
    radius?: number;
  },
) {
  page.drawRectangle({
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height,
    color: options.fill,
    borderColor: options.border,
    borderWidth: options.borderWidth ?? 0,
  });
}

function drawTextBlock(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  topY: number,
  maxWidth: number,
  size: number,
  color: ReturnType<typeof rgb>,
  lineHeight = size * 1.35,
  maxLines = 2,
) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    current = word;

    if (lines.length === maxLines - 1) {
      break;
    }
  }

  if (lines.length < maxLines && current) {
    lines.push(current);
  }

  if (lines.length > maxLines) {
    lines.length = maxLines;
  }

  if (words.length > 0 && lines.length === maxLines) {
    const consumed = lines.join(" ").split(/\s+/).filter(Boolean).length;

    if (consumed < words.length) {
      let lastLine = lines[maxLines - 1] ?? "";

      while (lastLine.length > 0 && font.widthOfTextAtSize(`${lastLine}...`, size) > maxWidth) {
        lastLine = lastLine.slice(0, -1).trimEnd();
      }

      lines[maxLines - 1] = `${lastLine}...`;
    }
  }

  for (const [index, line] of lines.entries()) {
    page.drawText(line, {
      x,
      y: topY - size - index * lineHeight,
      size,
      font,
      color,
    });
  }

  return lines.length;
}

function truncateToWidth(font: PDFFont, text: string, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) {
    return text;
  }

  let truncated = text;

  while (truncated.length > 1 && font.widthOfTextAtSize(`${truncated}...`, size) > maxWidth) {
    truncated = truncated.slice(0, -1).trimEnd();
  }

  return `${truncated}...`;
}

function drawLabel(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  topY: number,
  color: ReturnType<typeof rgb>,
) {
  page.drawText(text.toUpperCase(), {
    x,
    y: topY - 9,
    size: 8.6,
    font,
    color,
  });
}

function drawMetricCard(
  page: PDFPage,
  fonts: PdfFonts,
  options: {
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    value: string;
    helper: string;
    emphasis?: boolean;
  },
) {
  const fill = options.emphasis ? rgb(0.9, 0.97, 0.95) : rgb(0.965, 0.975, 0.988);
  const border = options.emphasis ? rgb(0.53, 0.78, 0.7) : rgb(0.67, 0.74, 0.83);
  const labelColor = rgb(0.44, 0.5, 0.61);
  const valueColor = rgb(0.03, 0.07, 0.15);
  const helperColor = rgb(0.4, 0.45, 0.53);
  const top = options.y + options.height - 18;
  const compactCard = !options.emphasis && options.height < 70;
  const valueSize = options.emphasis ? 28 : compactCard ? 17 : 21;
  const valueY = options.emphasis
    ? options.y + options.height - 78
    : options.y + options.height - (compactCard ? 42 : 46);
  const helperTop = options.emphasis
    ? options.y + 18
    : options.y + (compactCard ? 14 : 16);
  const helperSize = compactCard ? 8.8 : 9.5;
  const helperLines = options.emphasis ? 2 : compactCard ? 0 : 1;

  drawRect(page, {
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height,
    fill,
    border,
    borderWidth: 1.35,
    radius: options.emphasis ? 18 : 16,
  });

  drawLabel(page, fonts.mono, options.label, options.x + 16, top, labelColor);
  page.drawText(options.value, {
    x: options.x + 16,
    y: valueY,
    size: valueSize,
    font: fonts.semibold,
    color: valueColor,
  });

  if (helperLines > 0) {
    drawTextBlock(
      page,
      fonts.regular,
      options.helper,
      options.x + 16,
      helperTop,
      options.width - 32,
      helperSize,
      helperColor,
      compactCard ? 10.5 : 12,
      helperLines,
    );
  }
}

function drawDetailCard(
  page: PDFPage,
  fonts: PdfFonts,
  options: {
    x: number;
    y: number;
    width: number;
    height: number;
    title: string;
    rows: Array<{ label: string; sublabel: string; value: string }>;
  },
) {
  drawRect(page, {
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height,
    fill: rgb(0.965, 0.975, 0.988),
    border: rgb(0.67, 0.74, 0.83),
    borderWidth: 1.2,
    radius: 16,
  });

  drawLabel(page, fonts.mono, options.title, options.x + 16, options.y + options.height - 18, rgb(0.44, 0.5, 0.61));

  const rowHeight = 31;
  let cursorY = options.y + options.height - 42;

  for (const [index, row] of options.rows.entries()) {
    const rowLabel = truncateToWidth(fonts.semibold, row.label, 10.8, options.width - 100);

    page.drawText(rowLabel, {
      x: options.x + 16,
      y: cursorY - 11,
      size: 10.8,
      font: fonts.semibold,
      color: rgb(0.08, 0.12, 0.2),
    });
    page.drawText(row.value, {
      x: options.x + options.width - 16 - fonts.semibold.widthOfTextAtSize(row.value, 10.8),
      y: cursorY - 11,
      size: 10.8,
      font: fonts.semibold,
      color: rgb(0.08, 0.12, 0.2),
    });
    drawTextBlock(
      page,
      fonts.regular,
      row.sublabel,
      options.x + 16,
      cursorY - 18,
      options.width - 32,
      8.8,
      rgb(0.44, 0.5, 0.61),
      10,
      1,
    );

    if (index < options.rows.length - 1) {
      const dividerY = cursorY - rowHeight + 8;

      page.drawLine({
        start: { x: options.x + 16, y: dividerY },
        end: { x: options.x + options.width - 16, y: dividerY },
        thickness: 1,
        color: rgb(0.93, 0.95, 0.97),
      });
    }

    cursorY -= rowHeight;
  }
}

function truncateMiddle(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  const start = value.slice(0, Math.max(0, maxLength - 12));
  const end = value.slice(-9);
  return `${start}...${end}`;
}

export async function generateShareReportPdf(input: ShareReportPdfInput) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const page = pdf.addPage([pageWidth, pageHeight]);
  const [regularBytes, semiboldBytes, monoBytes] = await brandFontDataPromise;
  const regular = await pdf.embedFont(regularBytes, { subset: true });
  const semibold = await pdf.embedFont(semiboldBytes, { subset: true });
  const mono = await pdf.embedFont(monoBytes, { subset: true });

  const fonts: PdfFonts = { regular, semibold, mono };
  const topExpenseCategories = input.view.expensesByCategory.slice(0, 3);
  const totalExpenses = input.view.expensesByCategory.reduce((sum, item) => sum + item.value, 0);
  const topChannels = input.view.revenueByChannel
    .slice()
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, 3);

  drawRect(page, {
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    fill: rgb(0.95, 0.96, 0.98),
  });

  drawRect(page, {
    x: pageMargin,
    y: pageMargin,
    width: sheetWidth,
    height: sheetHeight,
    fill: rgb(1, 1, 1),
    border: rgb(0.76, 0.82, 0.89),
    borderWidth: 1.2,
    radius: 24,
  });

  const headerGap = 18;
  const metaCardWidth = 190;
  const headerLeftWidth = contentWidth - metaCardWidth - headerGap;
  const metaCardHeight = 56;
  const metaGap = 10;

  drawLabel(page, mono, "Hostlyx Financial Summary", contentX, contentTop - 2, rgb(0.44, 0.5, 0.61));
  page.drawText(input.businessName, {
    x: contentX,
    y: contentTop - 56,
    size: 29,
    font: semibold,
    color: rgb(0.03, 0.07, 0.15),
  });

  const descriptionTop = contentTop - 86;
  const descriptionLines = drawTextBlock(
    page,
    regular,
    "A clean snapshot of revenue, costs, profit, and what the business keeps after estimated taxes. Prepared for accountant, partner, or investor review.",
    contentX,
    descriptionTop,
    headerLeftWidth - 10,
    11.2,
    rgb(0.4, 0.45, 0.53),
    14.5,
    4,
  );

  const metaX = contentX + headerLeftWidth + headerGap;
  const metaTop = contentTop - 4;
  const metaRows = [
    { label: "Reporting period", value: input.view.rangeLabel },
    { label: "Generated", value: input.generatedAt },
    { label: "Source file", value: input.latestImportFileName ? truncateMiddle(input.latestImportFileName, 24) : "No file attached" },
  ];

  metaRows.forEach((row, index) => {
    const y = metaTop - (index + 1) * metaCardHeight - index * metaGap;
    drawRect(page, {
      x: metaX,
      y,
      width: metaCardWidth,
      height: metaCardHeight,
      fill: rgb(0.965, 0.975, 0.988),
      border: rgb(0.67, 0.74, 0.83),
      borderWidth: 1.2,
      radius: 14,
    });
    drawLabel(page, mono, row.label, metaX + 14, y + metaCardHeight - 12, rgb(0.44, 0.5, 0.61));
    drawTextBlock(
      page,
      row.label === "Source file" ? regular : semibold,
      row.value,
      metaX + 14,
      y + metaCardHeight - 24,
      metaCardWidth - 28,
      row.label === "Source file" ? 10 : 11.5,
      rgb(0.08, 0.12, 0.2),
      13,
      row.label === "Source file" ? 2 : 1,
    );
  });

  const descriptionBottom = descriptionTop - 11.2 - Math.max(0, descriptionLines - 1) * 14.5 - 10;
  const metaBottom = metaTop - metaRows.length * metaCardHeight - (metaRows.length - 1) * metaGap;
  const dividerY = Math.min(descriptionBottom, metaBottom) - 18;
  page.drawLine({
    start: { x: contentX, y: dividerY },
    end: { x: contentX + contentWidth, y: dividerY },
    thickness: 1,
    color: rgb(0.76, 0.82, 0.89),
  });

  const summaryTop = dividerY - 18;
  const heroHeight = 126;
  const sideGap = 10;
  const sideWidth = 170;
  const heroWidth = contentWidth - sideWidth - sideGap;
  const heroY = summaryTop - heroHeight;
  const stackedHeight = (heroHeight - sideGap) / 2;
  const sideX = contentX + heroWidth + sideGap;

  drawMetricCard(page, fonts, {
    x: contentX,
    y: heroY,
    width: heroWidth,
    height: heroHeight,
    label: "You Keep",
    value: formatCurrency(input.view.metrics.profitAfterTax, false, input.view.displayCurrencyCode),
    helper: "This is roughly what remains after setting aside estimated taxes.",
    emphasis: true,
  });

  drawMetricCard(page, fonts, {
    x: sideX,
    y: heroY + stackedHeight + sideGap,
    width: sideWidth,
    height: stackedHeight,
    label: "Set Aside",
    value: formatCurrency(input.view.metrics.estimatedTaxes, false, input.view.displayCurrencyCode),
    helper: "Estimated tax reserve.",
  });

  drawMetricCard(page, fonts, {
    x: sideX,
    y: heroY,
    width: sideWidth,
    height: stackedHeight,
    label: "Net Profit",
    value: formatCurrency(input.view.metrics.netProfit, false, input.view.displayCurrencyCode),
    helper: "Profit before taxes.",
  });

  const metricTop = heroY - 16;
  const metricHeight = 68;
  const metricGap = 12;
  const smallMetricWidth = (contentWidth - metricGap) / 2;
  const smallMetrics = [
    {
      label: "Revenue",
      value: formatCurrency(input.view.metrics.totalRevenue, false, input.view.displayCurrencyCode),
      helper: "Gross revenue.",
    },
    {
      label: "Expenses",
      value: formatCurrency(input.view.metrics.totalExpenses, false, input.view.displayCurrencyCode),
      helper: "Operating costs.",
    },
    {
      label: "Bookings",
      value: formatNumber(input.view.metrics.bookingsCount),
      helper: "Imported stays.",
    },
    {
      label: "Profit Margin",
      value: formatPercent(input.view.metrics.profitMargin),
      helper: "Profit before tax.",
    },
  ];

  smallMetrics.forEach((metric, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);

    drawMetricCard(page, fonts, {
      x: contentX + column * (smallMetricWidth + metricGap),
      y: metricTop - metricHeight - row * (metricHeight + metricGap),
      width: smallMetricWidth,
      height: metricHeight,
      ...metric,
    });
  });

  const metricsBottomY = metricTop - metricHeight - (metricHeight + metricGap);
  const detailTop = metricsBottomY - 18;
  const detailHeight = 136;
  const detailGap = 14;
  const detailWidth = (contentWidth - detailGap) / 2;
  const detailY = detailTop - detailHeight;

  drawDetailCard(page, fonts, {
    x: contentX,
    y: detailY,
    width: detailWidth,
    height: detailHeight,
    title: "Revenue by channel",
    rows: topChannels.map((channel) => ({
      label: channel.label,
      sublabel: `${formatNumber(channel.bookings)} bookings`,
      value: formatCurrency(channel.revenue, false, input.view.displayCurrencyCode),
    })),
  });

  drawDetailCard(page, fonts, {
    x: contentX + detailWidth + detailGap,
    y: detailY,
    width: detailWidth,
    height: detailHeight,
    title: "Expense structure",
    rows: topExpenseCategories.map((item) => ({
      label: item.label,
      sublabel: `${formatPercent(totalExpenses > 0 ? item.value / totalExpenses : 0)} of total expenses`,
      value: formatCurrency(item.value, false, input.view.displayCurrencyCode),
    })),
  });

  const footerText = input.view.monthlySummary[0]?.label && input.view.monthlySummary.at(-1)?.label
    ? `Coverage: ${input.view.monthlySummary[0].label} to ${input.view.monthlySummary.at(-1)?.label}. Generated by Hostlyx.`
    : "Generated by Hostlyx from imported bookings and expenses.";

  drawTextBlock(
    page,
    regular,
    footerText,
    contentX,
    Math.max(contentY + 18, detailY - 18),
    contentWidth,
    8.6,
    rgb(0.44, 0.5, 0.61),
    10,
    1,
  );

  return pdf.save();
}
