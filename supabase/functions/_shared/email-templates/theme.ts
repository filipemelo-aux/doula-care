// Doula Care brand tokens for transactional/auth emails
export const brand = {
  terracota: '#c34a1c',
  bege: '#ebe2dc',
  text: '#4a3f3a',
  heading: '#3a2b23',
  muted: '#8c7d75',
}

export const main = {
  backgroundColor: brand.bege,
  fontFamily: "'Nunito', 'Helvetica Neue', Arial, sans-serif",
  padding: '32px 0',
}

export const container = {
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  padding: '32px 28px',
  maxWidth: '520px',
  margin: '0 auto',
}

export const brandName = {
  fontSize: '13px',
  letterSpacing: '2px',
  textTransform: 'uppercase' as const,
  color: brand.terracota,
  fontWeight: 700 as const,
  margin: '0 0 20px',
}

export const h1 = {
  fontSize: '22px',
  fontWeight: 700 as const,
  color: brand.heading,
  margin: '0 0 16px',
}

export const text = {
  fontSize: '15px',
  color: brand.text,
  lineHeight: '1.6',
  margin: '0 0 20px',
}

export const link = { color: brand.terracota, textDecoration: 'underline' }

export const button = {
  backgroundColor: brand.terracota,
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 700 as const,
  borderRadius: '12px',
  padding: '14px 24px',
  textDecoration: 'none',
  display: 'inline-block',
}

export const codeStyle = {
  fontSize: '30px',
  letterSpacing: '8px',
  fontWeight: 700 as const,
  color: brand.terracota,
  margin: '0 0 24px',
}

export const footer = {
  fontSize: '12px',
  color: brand.muted,
  lineHeight: '1.5',
  margin: '28px 0 0',
}
