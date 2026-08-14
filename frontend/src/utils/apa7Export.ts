import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, BorderStyle, WidthType, AlignmentType } from 'docx'

// APA 7th edition table formatting (Publication Manual, Ch. 7):
//  - "Table N" in bold, flush left, above the table
//  - An italicized title in title case directly below the number
//  - The table itself uses horizontal rules only — a line above the
//    column headers, one below them, and one at the bottom — never
//    vertical lines or cell shading
//  - An optional "Note." line (itself italicized, body text roman) below
//    the table for source/definition notes
//
// This produces one Word document with exactly that structure, so a
// researcher can drop the export straight into a manuscript's tables
// appendix without manually reformatting a plain data dump.

export type Apa7TableExport = {
  tableNumber: number
  title: string
  columns: string[]
  rows: string[][]
  note?: string
}

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const RULE = { style: BorderStyle.SINGLE, size: 4, color: '000000' }

function headerCell(text: string): TableCell {
  return new TableCell({
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true })] })],
    borders: { top: RULE, bottom: RULE, left: NO_BORDER, right: NO_BORDER },
  })
}

function bodyCell(text: string, isLastRow: boolean): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun(text)] })],
    borders: {
      top: NO_BORDER,
      bottom: isLastRow ? RULE : NO_BORDER,
      left: NO_BORDER,
      right: NO_BORDER,
    },
  })
}

export async function buildApa7TableDocx(data: Apa7TableExport): Promise<Blob> {
  const headerRow = new TableRow({ children: data.columns.map((col) => headerCell(col)) })
  const bodyRows = data.rows.map((row, rowIndex) =>
    new TableRow({
      children: row.map((cell) => bodyCell(cell, rowIndex === data.rows.length - 1)),
    })
  )

  const children: (Paragraph | Table)[] = [
    new Paragraph({ children: [new TextRun({ text: `Table ${data.tableNumber}`, bold: true })] }),
    new Paragraph({ children: [new TextRun({ text: data.title, italics: true })] }),
    new Paragraph({ text: '' }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...bodyRows],
    }),
  ]

  if (data.note) {
    children.push(
      new Paragraph({ text: '' }),
      new Paragraph({
        children: [new TextRun({ text: 'Note. ', italics: true }), new TextRun({ text: data.note })],
      })
    )
  }

  const doc = new Document({
    sections: [{ children }],
  })

  return Packer.toBlob(doc)
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
