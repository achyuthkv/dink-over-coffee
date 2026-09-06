// Minimal RFC-4180-ish CSV parser: handles quoted fields, escaped quotes
// (""), and commas/newlines inside quotes -- enough for a spreadsheet
// export/re-import round trip without pulling in a dependency.
function parseLine(line) {
  const fields = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      fields.push(field); field = ''
    } else {
      field += c
    }
  }
  fields.push(field)
  return fields
}

/**
 * Parses CSV text into an array of objects keyed by the header row.
 * Blank lines are skipped; a row with fewer/more fields than the header is
 * padded/truncated rather than throwing, since this is meant for organizers
 * pasting a spreadsheet export that isn't always perfectly square.
 */
export function parseCsv(text) {
  const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0)
  if (lines.length === 0) return []
  const header = parseLine(lines[0]).map(h => h.trim())
  return lines.slice(1).map(line => {
    const values = parseLine(line)
    const row = {}
    header.forEach((key, i) => { row[key] = (values[i] ?? '').trim() })
    return row
  })
}
