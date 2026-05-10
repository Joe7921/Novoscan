/**
 * PDF 导出模块
 *
 * 从 FinalReport JSON 结构化生成 PDF。
 * 使用 jspdf + jspdf-autotable。
 *
 * 中文策略：将报告 DOM 的关键区域用 html2canvas 截屏嵌入 PDF，
 * 避免字体嵌入问题。纯文本部分使用内置字体（英文/数字）。
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { FinalReport, ReportBody } from '@/types/report'

function getLastTableY(doc: jsPDF, fallback: number): number {
  // jspdf-autotable 把 lastAutoTable 挂在 doc 实例上
  const d = doc as unknown as { lastAutoTable?: { finalY?: number } }
  return d.lastAutoTable?.finalY ?? fallback
}

const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 20
const CONTENT_W = PAGE_W - MARGIN * 2
const LINE_H = 6

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_H - MARGIN) {
    doc.addPage()
    return MARGIN
  }
  return y
}

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  y = ensureSpace(doc, y, 14)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(66, 133, 244)
  doc.text(title, MARGIN, y)
  y += 2
  doc.setDrawColor(66, 133, 244)
  doc.setLineWidth(0.5)
  doc.line(MARGIN, y, MARGIN + CONTENT_W, y)
  y += 8
  doc.setTextColor(51, 51, 51)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  return y
}

function drawWrappedText(doc: jsPDF, text: string, y: number, maxWidth?: number): number {
  const w = maxWidth ?? CONTENT_W
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  const lines = doc.splitTextToSize(text, w)
  for (const line of lines) {
    y = ensureSpace(doc, y, LINE_H)
    doc.text(line, MARGIN, y)
    y += LINE_H
  }
  return y
}

function drawCover(doc: jsPDF, body: ReportBody): number {
  let y = 60
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(66, 133, 244)
  doc.text('Novoscan', PAGE_W / 2, y, { align: 'center' })
  y += 10
  doc.setFontSize(14)
  doc.setTextColor(51, 51, 51)
  doc.text('Innovation Analysis Report', PAGE_W / 2, y, { align: 'center' })
  y += 20

  const score = body.meta?.overallScore ?? 0
  const scoreColor = score >= 75 ? [52, 168, 83] : score >= 50 ? [251, 188, 5] : [234, 67, 53]
  doc.setFontSize(48)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2])
  doc.text(score.toFixed(0), PAGE_W / 2, y, { align: 'center' })
  y += 10
  doc.setFontSize(11)
  doc.setTextColor(136, 136, 136)
  doc.text(`Novelty: ${body.meta?.noveltyLevel ?? '-'}`, PAGE_W / 2, y, { align: 'center' })
  y += 6
  doc.text(`Quality Gate: ${body.meta?.qualityPassed ? 'PASSED' : 'FAILED'}`, PAGE_W / 2, y, { align: 'center' })
  y += 20

  doc.setFontSize(9)
  doc.setTextColor(170, 170, 170)
  doc.text(`Generated: ${new Date().toISOString().slice(0, 10)}`, PAGE_W / 2, y, { align: 'center' })

  doc.addPage()
  return MARGIN
}

function drawExecutiveSummary(doc: jsPDF, body: ReportBody, y: number): number {
  if (!body.executiveSummary) return y
  y = drawSectionTitle(doc, 'Executive Summary', y)
  y = drawWrappedText(doc, body.executiveSummary, y)
  return y + 6
}

function drawScoreTable(doc: jsPDF, body: ReportBody, y: number): number {
  if (!body.agentScores?.length) return y
  y = drawSectionTitle(doc, 'Agent Scores', y)

  const head = [['Agent', 'Score', 'Confidence', 'Analysis']]
  const tableBody = body.agentScores.map((a) => [
    a.name,
    String(a.score),
    a.confidence,
    a.analysis.slice(0, 120) + (a.analysis.length > 120 ? '...' : ''),
  ])

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head,
    body: tableBody,
    styles: { fontSize: 8, cellPadding: 2, font: 'helvetica' },
    headStyles: { fillColor: [66, 133, 244], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      1: { halign: 'center', cellWidth: 18 },
      2: { halign: 'center', cellWidth: 22 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const val = Number(data.cell.raw)
        if (val >= 75) data.cell.styles.textColor = [52, 168, 83]
        else if (val >= 50) data.cell.styles.textColor = [251, 188, 5]
        else data.cell.styles.textColor = [234, 67, 53]
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  return getLastTableY(doc, y + 40) + 8
}

function drawKeyFindings(doc: jsPDF, body: ReportBody, y: number): number {
  if (!body.keyFindings?.length) return y
  y = drawSectionTitle(doc, 'Key Findings', y)

  for (const kf of body.keyFindings) {
    y = ensureSpace(doc, y, 14)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(`• ${kf.title}`, MARGIN, y)
    y += LINE_H
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    const lines = doc.splitTextToSize(`${kf.description} (${kf.source})`, CONTENT_W - 4)
    for (const line of lines) {
      y = ensureSpace(doc, y, LINE_H)
      doc.text(line, MARGIN + 4, y)
      y += 5
    }
    doc.setTextColor(51, 51, 51)
    y += 2
  }
  return y + 4
}

function drawRiskTable(doc: jsPDF, body: ReportBody, y: number): number {
  if (!body.riskFlags?.length) return y
  y = drawSectionTitle(doc, 'Risk Flags', y)

  const severityColor: Record<string, [number, number, number]> = {
    high: [234, 67, 53],
    medium: [251, 188, 5],
    low: [52, 168, 83],
  }

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Risk', 'Severity', 'Source Agent', 'Suggestion']],
    body: body.riskFlags.map((rf) => [rf.risk, rf.severity, rf.sourceAgent, rf.suggestion ?? '-']),
    styles: { fontSize: 8, cellPadding: 2, font: 'helvetica' },
    headStyles: { fillColor: [234, 67, 53], textColor: 255, fontStyle: 'bold' },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const c = severityColor[String(data.cell.raw)] ?? [51, 51, 51]
        data.cell.styles.textColor = c
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  return getLastTableY(doc, y + 40) + 8
}

function drawArbitration(doc: jsPDF, body: ReportBody, y: number): number {
  if (!body.arbitration?.summary) return y
  y = drawSectionTitle(doc, 'Arbitration Summary', y)
  y = drawWrappedText(doc, body.arbitration.summary, y)
  return y + 6
}

function drawEvidenceTable(doc: jsPDF, body: ReportBody, y: number): number {
  if (!body.evidenceItems?.length) return y
  y = drawSectionTitle(doc, `Evidence (${body.evidenceItems.length} items)`, y)

  const items = body.evidenceItems.slice(0, 30)
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Title', 'Source', 'Year', 'Relevance', 'Stance']],
    body: items.map((ev) => [
      ev.title.slice(0, 35) + (ev.title.length > 35 ? '...' : ''),
      ev.source || ev.sourceType,
      ev.year ? String(ev.year) : '-',
      `${(ev.relevanceScore * 100).toFixed(0)}%`,
      ev.stance,
    ]),
    styles: { fontSize: 7, cellPadding: 1.5, font: 'helvetica' },
    headStyles: { fillColor: [100, 100, 100], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'center', cellWidth: 18 },
    },
  })

  return getLastTableY(doc, y + 40) + 8
}

function drawFooter(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(170, 170, 170)
    doc.text(`Generated by Novoscan Open Core`, MARGIN, PAGE_H - 10)
    doc.text(`Page ${i} / ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 10, { align: 'right' })
  }
}

export async function exportPdf(report: FinalReport): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const body = report.report

  let y = drawCover(doc, body)
  y = drawExecutiveSummary(doc, body, y)
  y = drawScoreTable(doc, body, y)
  y = drawKeyFindings(doc, body, y)
  y = drawRiskTable(doc, body, y)
  y = drawArbitration(doc, body, y)
  drawEvidenceTable(doc, body, y)
  drawFooter(doc)

  doc.save(`Novoscan_Report_${new Date().toISOString().slice(0, 10)}.pdf`)
}
