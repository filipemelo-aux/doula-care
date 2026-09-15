import { BrandingSettingsCard } from "@/components/settings/BrandingSettingsCard";

export default function MyBrand() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Minha Marca</h1>
        <p className="page-description">
          Personalize o nome, o logotipo e as cores que suas clientes veem no aplicativo.
        </p>
      </div>
      <BrandingSettingsCard />
    </div>
  );
}
