import { PageHeader } from "../../../../components/ui";
import { TFTImportForm } from "../../../../components/cashflow/TFTImportForm";

export default function Page() {
  return (
    <>
      <PageHeader
        title="Importer un grand livre → générer le TFT"
        description="Le tableau des flux se calcule sur l'ensemble de vos écritures de la période, de façon 100 % déterministe."
      />
      <TFTImportForm />
    </>
  );
}
