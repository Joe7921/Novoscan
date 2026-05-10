import { useState, useCallback } from 'react'
import { FileDown, FileText, Loader2 } from 'lucide-react'
import type { FinalReport } from '@/types/report'

interface ExportButtonsProps {
  report: FinalReport
}

export default function ExportButtons({ report }: ExportButtonsProps) {
  const [pdfLoading, setPdfLoading] = useState(false)
  const [docxLoading, setDocxLoading] = useState(false)

  const handlePdf = useCallback(async () => {
    setPdfLoading(true)
    try {
      const { exportPdf } = await import('@/lib/exportPdf')
      await exportPdf(report)
    } catch (err) {
      console.error('PDF export failed:', err)
    } finally {
      setPdfLoading(false)
    }
  }, [report])

  const handleDocx = useCallback(async () => {
    setDocxLoading(true)
    try {
      const { exportDocx } = await import('@/lib/exportDocx')
      await exportDocx(report)
    } catch (err) {
      console.error('DOCX export failed:', err)
    } finally {
      setDocxLoading(false)
    }
  }, [report])

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={handlePdf}
        disabled={pdfLoading}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border"
        style={{
          borderColor: 'var(--novo-border-default)',
          color: pdfLoading ? 'var(--novo-text-disabled)' : 'var(--novo-text-secondary)',
          background: 'var(--novo-bg-elevated)',
        }}
        title="导出 PDF"
      >
        {pdfLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />}
        PDF
      </button>
      <button
        onClick={handleDocx}
        disabled={docxLoading}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border"
        style={{
          borderColor: 'var(--novo-border-default)',
          color: docxLoading ? 'var(--novo-text-disabled)' : 'var(--novo-text-secondary)',
          background: 'var(--novo-bg-elevated)',
        }}
        title="导出 Word"
      >
        {docxLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
        DOC
      </button>
    </div>
  )
}
