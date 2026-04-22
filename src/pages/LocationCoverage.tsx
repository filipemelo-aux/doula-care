import { LocationSettingsCard } from "@/components/settings/LocationSettingsCard";

export default function LocationCoverage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Localização e Atendimento</h1>
        <p className="page-description">
          Defina onde você atende para que gestantes encontrem você no mapa público.
        </p>
      </div>
      <LocationSettingsCard />
    </div>
  );
}
