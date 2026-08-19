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

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Redefinição de senha - {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brandName}>{siteName}</Text>
        <Heading style={h1}>Redefinir sua senha</Heading>
        <Text style={text}>
          Recebemos um pedido para redefinir a senha da sua conta. Clique no
          botão abaixo para criar uma nova senha.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Criar nova senha
        </Button>
        <Text style={footer}>
          Este link expira em pouco tempo por segurança. Se você não pediu a
          redefinição, pode ignorar este e-mail com tranquilidade.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
