/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

import { main, container, brandName, h1, text, button, footer } from './theme.ts'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu link de acesso - {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brandName}>{siteName}</Text>
        <Heading style={h1}>Seu link de acesso</Heading>
        <Text style={text}>
          Use o botão abaixo para entrar na sua conta sem precisar digitar
          senha.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Entrar agora
        </Button>
        <Text style={footer}>
          O link é de uso único e expira em pouco tempo. Se não foi você quem
          solicitou, ignore este e-mail.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail
