---
name: pregnancy-week-illustrations
description: Padrão visual e biológico obrigatório para a sequência de imagens semana-a-semana da gestação (week-01 a week-40)
type: design
---

# Padrão das Ilustrações Semanais da Gestação

Aplicar a TODAS as imagens em `src/assets/pregnancy/week-XX.webp`.

## Padrão Visual Global
- **Estilo:** Ilustração 3D médica ultra detalhada, soft, educativa
- **Iluminação:** Suave, quente, realista (tons amber/peach), consistente entre semanas
- **Paleta:** Rosa salmão para tecidos internos, cremes/âmbar para fundo neutro, mesma paleta entre todas as semanas
- **Enquadramento:** Progressivo e contínuo entre semanas (sem cortes bruscos de escala)
- **Profundidade de campo:** Fundo suavemente desfocado
- **Sem texto, sem labels, sem rótulos**

## Regra Biológica Crítica
- Evolução **contínua e proporcional** semana a semana
- **NÃO pular etapas biológicas**
- **NÃO antecipar desenvolvimento fetal** (sem "bebê" antes da hora)
- Seguir embriologia humana real: fecundação (S1) → blastocisto migrando (S2) → implantação (S3) → saco gestacional + saco vitelino (S4) → embrião → feto

## Comparação de Tamanho
- Sempre incluir referência alimentar real (semente de papoula, gergelim, chia, etc.)
- A referência deve ficar **fora do ambiente biológico**, em superfície neutra cremosa

## Continuidade
Ao gerar nova semana, sempre usar a semana anterior como `image_paths` no `imagegen--edit_image` para preservar paleta, iluminação e estilo.
