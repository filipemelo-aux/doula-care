/**
 * Generates a Pix EMV payload string for static QR codes.
 * Based on the BR Code specification (EMV QRCPS-MPM).
 */

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function computeCRC16(payload: string): string {
  const polynomial = 0x1021;
  let crc = 0xffff;
  const bytes = new TextEncoder().encode(payload);
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ polynomial) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

interface PixPayload {
  pixKey: string;
  beneficiaryName: string;
  city: string;
  amount?: number;
  txId?: string;
}

export function generatePixPayload({
  pixKey,
  beneficiaryName,
  city,
  amount,
  txId = "***",
}: PixPayload): string {
  // Payload Format Indicator
  let payload = tlv("00", "01");

  // Merchant Account Information (Pix)
  const gui = tlv("00", "br.gov.bcb.pix");
  const key = tlv("01", pixKey);
  payload += tlv("26", gui + key);

  // Merchant Category Code
  payload += tlv("52", "0000");

  // Transaction Currency (986 = BRL)
  payload += tlv("53", "986");

  // Transaction Amount (optional)
  if (amount && amount > 0) {
    payload += tlv("54", amount.toFixed(2));
  }

  // Country Code
  payload += tlv("58", "BR");

  // Merchant Name (max 25 chars)
  const name = beneficiaryName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .substring(0, 25);
  payload += tlv("59", name);

  // Merchant City (max 15 chars)
  const cityClean = city
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .substring(0, 15);
  payload += tlv("60", cityClean);

  // Additional Data Field Template
  payload += tlv("62", tlv("05", txId));

  // CRC16 placeholder
  payload += "6304";

  // Calculate CRC16
  const crc = computeCRC16(payload);
  payload += crc;

  return payload;
}
