import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
    lineHeight: 1.5,
  },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  meta: { fontSize: 10, color: '#666', marginBottom: 20 },
  heading: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginTop: 18,
    marginBottom: 8,
  },
  body: { marginBottom: 12, color: '#222' },
  bullet: { flexDirection: 'row', marginBottom: 4 },
  bulletDot: { width: 14, color: '#666' },
  bulletText: { flex: 1, color: '#222' },
  transcript: { fontSize: 9, color: '#444', marginTop: 4 },
})

interface ExportBody {
  title?: string
  duration?: string
  summary: string
  keyPoints: string[]
  transcript?: string
}

function SummaryPdf({
  title,
  duration,
  summary,
  keyPoints,
  transcript,
}: ExportBody) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title || 'YouTube video'}</Text>
        <Text style={styles.meta}>Duration: {duration || 'Unknown'}</Text>

        <Text style={styles.heading}>Summary</Text>
        <Text style={styles.body}>{summary}</Text>

        {keyPoints.length > 0 && (
          <View>
            <Text style={styles.heading}>Key Points</Text>
            {keyPoints.map((point, i) => (
              <View key={i} style={styles.bullet}>
                <Text style={styles.bulletDot}>{'\u2022'}</Text>
                <Text style={styles.bulletText}>{point}</Text>
              </View>
            ))}
          </View>
        )}

        {transcript && (
          <View>
            <Text style={styles.heading}>Transcript</Text>
            <Text style={styles.transcript}>{transcript}</Text>
          </View>
        )}
      </Page>
    </Document>
  )
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ExportBody

    if (!body.summary) {
      return new Response(JSON.stringify({ error: 'Summary is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const blob = await pdf(<SummaryPdf {...body} />).toBlob()
    const buffer = Buffer.from(await blob.arrayBuffer())

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${(body.title || 'youtube-summary').replace(/"/g, '')}.pdf"`,
      },
    })
  } catch {
    return new Response(
      JSON.stringify({ error: 'Failed to generate PDF.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
