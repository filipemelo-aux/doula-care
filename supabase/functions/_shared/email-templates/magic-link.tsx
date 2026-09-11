/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

import { main, container, brandName, h1, text, footer } from './theme.ts'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
  token?: string
}

const codeStyle: React.CSSProperties = {
  fontSize: '34px',
  letterSpacing: '10px',
  fontWeight: 700,
  textAlign: 'center',
  margin: '24px 0',
  color: '#c34a1c',
}

export const MagicLinkEmail = ({
  siteName,
  token,
}: MagicLinkEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu código de verificação - {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brandName}>{siteName}</Text>
        <Heading style={h1}>Seu código de verificação</Heading>
        <Text style={text}>
          Digite o código abaixo no aplicativo para confirmar o seu e-mail e
          continuar o cadastro.
        </Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          O código é de uso único e expira em pouco tempo. Se não foi você quem
          solicitou, ignore este e-mail.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail
