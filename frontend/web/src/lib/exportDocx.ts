/**
 * Word (DOCX) 导出模块
 *
 * 从 FinalReport JSON 结构化生成 .docx 文件。
 */

import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Packer,
  type ITableCellBorders,
} from 'docx'
import { saveAs } from 'file-saver'
import type { FinalReport, ReportBody } from '@/types/report'

const THIN_BORDER: ITableCellBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
  left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
  right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
}

function headerCell(text: string): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: 18, font: 'Microsoft YaHei' })],
      }),
    ],
    borders: THIN_BORDER,
    shading: { fill: 'F2F2F2' },
  })
}

function bodyCell(text: string, color?: string): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, size: 18, font: 'Microsoft YaHei', color: color ?? '333333' })],
      }),
    ],
    borders: THIN_BORDER,
  })
}

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_2): Paragraph {
  return new Paragraph({
    heading: level,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 24, font: 'Microsoft YaHei' })],
  })
}

function bodyParagraph(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, size: 20, font: 'Microsoft YaHei' })],
  })
}

function buildCoverSection(body: ReportBody): Paragraph[] {
  const score = body.meta?.overallScore ?? 0
  const novelty = body.meta?.noveltyLevel ?? '—'
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 600, after: 200 },
      children: [new TextRun({ text: 'Novoscan 创新分析报告', bold: true, size: 36, font: 'Microsoft YaHei' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({ text: `总分: ${score.toFixed(0)}`, size: 28, font: 'Microsoft YaHei', bold: true }),
        new TextRun({ text: `  |  创新等级: ${novelty}`, size: 22, font: 'Microsoft YaHei' }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({
          text: `生成日期: ${new Date().toLocaleDateString('zh-CN')}`,
          size: 18,
          font: 'Microsoft YaHei',
          color: '888888',
        }),
      ],
    }),
  ]
}

function buildExecutiveSummary(body: ReportBody): Paragraph[] {
  if (!body.executiveSummary) return []
  return [heading('高管摘要'), bodyParagraph(body.executiveSummary)]
}

function buildScoreTable(body: ReportBody): (Paragraph | Table)[] {
  if (!body.agentScores?.length) return []
  const rows = [
    new TableRow({
      children: [headerCell('Agent'), headerCell('分数'), headerCell('置信度'), headerCell('分析摘要')],
    }),
    ...body.agentScores.map(
      (a) =>
        new TableRow({
          children: [
            bodyCell(a.name),
            bodyCell(String(a.score), a.score >= 75 ? '34A853' : a.score >= 50 ? 'FBBC05' : 'EA4335'),
            bodyCell(a.confidence),
            bodyCell(a.analysis.slice(0, 200) + (a.analysis.length > 200 ? '...' : '')),
          ],
        }),
    ),
  ]

  return [
    heading('评分详情'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows,
    }),
  ]
}

function buildKeyFindings(body: ReportBody): Paragraph[] {
  if (!body.keyFindings?.length) return []
  return [
    heading('关键发现'),
    ...body.keyFindings.map(
      (kf) =>
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({ text: `● ${kf.title}`, bold: true, size: 20, font: 'Microsoft YaHei' }),
            new TextRun({ text: ` — ${kf.description}`, size: 18, font: 'Microsoft YaHei' }),
            new TextRun({ text: ` (${kf.source})`, size: 16, font: 'Microsoft YaHei', color: '888888' }),
          ],
        }),
    ),
  ]
}

function buildRiskTable(body: ReportBody): (Paragraph | Table)[] {
  if (!body.riskFlags?.length) return []
  const severityColor: Record<string, string> = { high: 'EA4335', medium: 'FBBC05', low: '34A853' }
  const rows = [
    new TableRow({
      children: [headerCell('风险项'), headerCell('严重度'), headerCell('来源Agent'), headerCell('建议')],
    }),
    ...body.riskFlags.map(
      (rf) =>
        new TableRow({
          children: [
            bodyCell(rf.risk),
            bodyCell(rf.severity, severityColor[rf.severity] ?? '333333'),
            bodyCell(rf.sourceAgent),
            bodyCell(rf.suggestion ?? '—'),
          ],
        }),
    ),
  ]

  return [
    heading('风险清单'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows,
    }),
  ]
}

function buildArbitration(body: ReportBody): Paragraph[] {
  if (!body.arbitration?.summary) return []
  return [heading('仲裁结论'), bodyParagraph(body.arbitration.summary)]
}

function buildEvidenceTable(body: ReportBody): (Paragraph | Table)[] {
  if (!body.evidenceItems?.length) return []
  const rows = [
    new TableRow({
      children: [headerCell('标题'), headerCell('来源'), headerCell('年份'), headerCell('相关性'), headerCell('立场')],
    }),
    ...body.evidenceItems.slice(0, 30).map(
      (ev) =>
        new TableRow({
          children: [
            bodyCell(ev.title.slice(0, 40) + (ev.title.length > 40 ? '...' : '')),
            bodyCell(ev.source || ev.sourceType),
            bodyCell(ev.year ? String(ev.year) : '—'),
            bodyCell(`${(ev.relevanceScore * 100).toFixed(0)}%`),
            bodyCell(ev.stance),
          ],
        }),
    ),
  ]

  return [
    heading('证据列表'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows,
    }),
  ]
}

function buildFooter(): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 400 },
    children: [
      new TextRun({
        text: 'Generated by Novoscan Open Core',
        size: 14,
        font: 'Microsoft YaHei',
        color: 'AAAAAA',
        italics: true,
      }),
    ],
  })
}

export async function exportDocx(report: FinalReport): Promise<void> {
  const body = report.report

  const children: (Paragraph | Table)[] = [
    ...buildCoverSection(body),
    ...buildExecutiveSummary(body),
    ...buildScoreTable(body),
    ...buildKeyFindings(body),
    ...buildRiskTable(body),
    ...buildArbitration(body),
    ...buildEvidenceTable(body),
    buildFooter(),
  ]

  const doc = new Document({
    sections: [{ children }],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `Novoscan_Report_${new Date().toISOString().slice(0, 10)}.docx`)
}
