export interface MarLabel {
  en: string;
  nl: string;
  fr: string;
}

/** Combined printed-form codes that share a detail-line label. */
export const MAR_LABEL_ALIASES: Record<string, readonly string[]> = {
  "73/74": ["74"],
  "635/9": ["635/8"],
  "694/6": ["694/7"],
};

function L(en: string, nl: string, fr: string): MarLabel {
  return { en, nl, fr };
}

/** Official NBB printed-form names (VOL-kap plus common VKT/MIC lines). */
export const MAR_LABELS: Record<string, MarLabel> = {
  // --- Assets ---
  "20/58": L("TOTAL ASSETS", "TOTAAL DER ACTIVA", "TOTAL DE L’ACTIF"),
  "20/28": L("FIXED ASSETS", "VASTE ACTIVA", "ACTIFS IMMOBILISÉS"),
  "21/28": L("FIXED ASSETS", "VASTE ACTIVA", "ACTIFS IMMOBILISÉS"),
  "20": L("Formation expenses", "Oprichtingskosten", "Frais d’établissement"),
  "21": L("Intangible fixed assets", "Immateriële vaste activa", "Immobilisations incorporelles"),
  "22/27": L("Tangible fixed assets", "Materiële vaste activa", "Immobilisations corporelles"),
  "22": L("Land and buildings", "Terreinen en gebouwen", "Terrains et constructions"),
  "23": L("Plant, machinery and equipment", "Installaties, machines en uitrusting", "Installations, machines et outillage"),
  "24": L("Furniture and vehicles", "Meubilair en rollend materieel", "Mobilier et matériel roulant"),
  "25": L("Leasing and similar rights", "Leasing en soortgelijke rechten", "Location-financement et droits similaires"),
  "26": L("Other tangible fixed assets", "Overige materiële vaste activa", "Autres immobilisations corporelles"),
  "27": L("Assets under construction and advance payments", "Activa in aanbouw en vooruitbetalingen", "Immobilisations en cours et acomptes versés"),
  "28": L("Financial fixed assets", "Financiële vaste activa", "Immobilisations financières"),
  "280/1": L("Affiliated enterprises", "Verbonden ondernemingen", "Entreprises liées"),
  "280": L("Participating interests", "Deelnemingen", "Participations"),
  "281": L("Amounts receivable", "Vorderingen", "Créances"),
  "282/3": L("Enterprises linked by participating interests", "Ondernemingen waarmee een deelnemingsverhouding bestaat", "Entreprises avec lesquelles il existe un lien de participation"),
  "282": L("Participating interests", "Deelnemingen", "Participations"),
  "283": L("Amounts receivable", "Vorderingen", "Créances"),
  "284/8": L("Other financial fixed assets", "Andere financiële vaste activa", "Autres immobilisations financières"),
  "284": L("Shares", "Aandelen", "Actions et parts"),
  "285/8": L("Amounts receivable and cash guarantees", "Vorderingen en borgtochten in contanten", "Créances et cautionnements en numéraire"),
  "29/58": L("CURRENT ASSETS", "VLOTTENDE ACTIVA", "ACTIFS CIRCULANTS"),
  "29": L("Amounts receivable after more than one year", "Vorderingen op meer dan één jaar", "Créances à plus d’un an"),
  "290": L("Trade debtors", "Handelsvorderingen", "Créances commerciales"),
  "291": L("Other amounts receivable", "Overige vorderingen", "Autres créances"),
  "3": L("Inventories and contracts in progress", "Voorraden en bestellingen in uitvoering", "Stocks et commandes en cours d’exécution"),
  "30/36": L("Inventories", "Voorraden", "Stocks"),
  "30/31": L("Raw materials and consumables", "Grond- en hulpstoffen", "Approvisionnements"),
  "30": L("Raw materials", "Grondstoffen", "Matières premières"),
  "31": L("Consumables", "Hulpstoffen", "Fournitures"),
  "32": L("Work in progress", "Goederen in bewerking", "En-cours de fabrication"),
  "33": L("Finished goods", "Gereed product", "Produits finis"),
  "34": L("Goods purchased for resale", "Handelsgoederen", "Marchandises"),
  "35": L("Immovable property intended for sale", "Onroerende goederen bestemd voor verkoop", "Immeubles destinés à la vente"),
  "36": L("Advance payments", "Vooruitbetalingen", "Acomptes versés"),
  "37": L("Contracts in progress", "Bestellingen in uitvoering", "Commandes en cours d’exécution"),
  "40/41": L("Amounts receivable within one year", "Vorderingen op ten hoogste één jaar", "Créances à un an au plus"),
  "40": L("Trade debtors", "Handelsvorderingen", "Créances commerciales"),
  "41": L("Other amounts receivable", "Overige vorderingen", "Autres créances"),
  "50/53": L("Current investments", "Geldbeleggingen", "Placements de trésorerie"),
  "50": L("Own shares", "Eigen aandelen", "Actions propres"),
  "51/53": L("Other investments", "Overige beleggingen", "Autres placements"),
  "51": L("Other investments", "Overige beleggingen", "Autres placements"),
  "54/58": L("Cash at bank and in hand", "Liquide middelen", "Valeurs disponibles"),
  "490/1": L("Deferred charges and accrued income", "Overlopende rekeningen", "Comptes de régularisation"),
  "490": L("Deferred charges", "Over te dragen kosten", "Charges à reporter"),
  "491": L("Accrued income", "Verkregen opbrengsten", "Produits acquis"),

  // --- Equity and liabilities ---
  "10/49": L("TOTAL LIABILITIES", "TOTAAL DER PASSIVA", "TOTAL DU PASSIF"),
  "10/15": L("EQUITY", "EIGEN VERMOGEN", "CAPITAUX PROPRES"),
  "10": L("Capital", "Kapitaal", "Capital"),
  "100": L("Issued capital", "Geplaatst kapitaal", "Capital souscrit"),
  "101": L("Uncalled capital", "Niet-opgevraagd kapitaal", "Capital non appelé"),
  "11": L("Share premium account", "Uitgiftepremies", "Primes d’émission"),
  "110": L("Available", "Beschikbaar", "Disponible"),
  "111": L("Unavailable", "Onbeschikbaar", "Indisponible"),
  "12": L("Revaluation surpluses", "Herwaarderingsmeerwaarden", "Plus-values de réévaluation"),
  "13": L("Reserves", "Reserves", "Réserves"),
  "130": L("Legal reserve", "Wettelijke reserve", "Réserve légale"),
  "130/1": L("Legal reserve", "Wettelijke reserve", "Réserve légale"),
  "131": L("Reserves not available for distribution", "Onbeschikbare reserves", "Réserves indisponibles"),
  "1311": L("In respect of own shares held", "Voor eigen aandelen", "Pour actions propres"),
  "1312": L("Other", "Andere", "Autres"),
  "132": L("Untaxed reserves", "Belastingvrije reserves", "Réserves immunisées"),
  "133": L("Available reserves", "Beschikbare reserves", "Réserves disponibles"),
  "14": L("Accumulated profits (losses)", "Overgedragen winst (verlies)", "Bénéfice (Perte) reporté(e)"),
  "14P": L("Accumulated profits (losses) of the previous period", "Overgedragen winst (verlies) van het vorige boekjaar", "Bénéfice (Perte) reporté(e) de l’exercice précédent"),
  "15": L("Investment grants", "Kapitaalsubsidies", "Subsides en capital"),
  "16": L("Provisions and deferred taxes", "Voorzieningen en uitgestelde belastingen", "Provisions et impôts différés"),
  "160/5": L("Provisions for liabilities and charges", "Voorzieningen voor risico’s en kosten", "Provisions pour risques et charges"),
  "19": L(
    "Advances to associates on the distribution of net assets",
    "Voorschot aan vennoten op verdeling van het netto-actief",
    "Acomptes aux associés sur la répartition de l’actif net",
  ),
  "160": L("Pensions and similar obligations", "Pensioenen en soortgelijke verplichtingen", "Pensions et obligations similaires"),
  "161": L("Taxation", "Belastingen", "Charges fiscales"),
  "162": L("Major repairs and maintenance", "Grote herstellings- en onderhoudswerken", "Grosses réparations et gros entretien"),
  "163": L("Environmental obligations", "Milieuverplichtingen", "Obligations environnementales"),
  "164/5": L("Other liabilities and charges", "Overige risico’s en kosten", "Autres risques et charges"),
  "167": L(
    "Provisions for subsidies, bequests and gifts to be repaid",
    "Voorzieningen voor terug te betalen subsidies en legaten",
    "Provisions pour subsides et legs à rembourser",
  ),
  "168": L("Deferred taxes", "Uitgestelde belastingen", "Impôts différés"),
  "17/49": L("AMOUNTS PAYABLE", "SCHULDEN", "DETTES"),
  "17": L("Amounts payable after more than one year", "Schulden op meer dan één jaar", "Dettes à plus d’un an"),
  "170/4": L("Financial debts", "Financiële schulden", "Dettes financières"),
  "170": L("Subordinated loans", "Achtergestelde leningen", "Emprunts subordonnés"),
  "171": L("Unsubordinated debentures", "Niet-achtergestelde obligatieleningen", "Emprunts obligataires non subordonnés"),
  "172/3": L("Leasing and similar obligations", "Leasingschulden en soortgelijke schulden", "Dettes de location-financement et assimilées"),
  "172": L("Leasing and similar obligations", "Leasingschulden en soortgelijke schulden", "Dettes de location-financement et assimilées"),
  "173": L("Credit institutions", "Kredietinstellingen", "Établissements de crédit"),
  "174": L("Other loans", "Overige leningen", "Autres emprunts"),
  "175": L("Trade debts", "Handelsschulden", "Dettes commerciales"),
  "1750": L("Suppliers", "Leveranciers", "Fournisseurs"),
  "1751": L("Bills of exchange payable", "Te betalen wissels", "Effets à payer"),
  "176": L("Advances received on contracts in progress", "Ontvangen vooruitbetalingen op bestellingen", "Acomptes reçus sur commandes"),
  "178/9": L("Other amounts payable", "Overige schulden", "Autres dettes"),
  "42/48": L("Amounts payable within one year", "Schulden op ten hoogste één jaar", "Dettes à un an au plus"),
  "42": L("Current portion of amounts payable after more than one year", "Schulden op meer dan één jaar die binnen het jaar vervallen", "Dettes à plus d’un an échéant dans l’année"),
  "43": L("Financial debts", "Financiële schulden", "Dettes financières"),
  "430/8": L("Credit institutions", "Kredietinstellingen", "Établissements de crédit"),
  "439": L("Other loans", "Overige leningen", "Autres emprunts"),
  "44": L("Trade debts", "Handelsschulden", "Dettes commerciales"),
  "440/4": L("Suppliers", "Leveranciers", "Fournisseurs"),
  "441": L("Bills of exchange payable", "Te betalen wissels", "Effets à payer"),
  "45": L("Taxes, remuneration and social security", "Schulden met betrekking tot belastingen, bezoldigingen en sociale lasten", "Dettes fiscales, salariales et sociales"),
  "450/3": L("Taxes", "Belastingen", "Impôts"),
  "454/9": L("Remuneration and social security", "Bezoldigingen en sociale lasten", "Rémunérations et charges sociales"),
  "46": L("Advances received on contracts in progress", "Ontvangen vooruitbetalingen op bestellingen", "Acomptes reçus sur commandes"),
  "47/48": L("Other amounts payable", "Overige schulden", "Autres dettes"),
  "48": L("Other amounts payable", "Overige schulden", "Autres dettes"),
  "492/3": L("Accruals and deferred income", "Overlopende rekeningen", "Comptes de régularisation"),
  "492": L("Accrued charges", "Toe te rekenen kosten", "Charges à imputer"),
  "493": L("Deferred income", "Over te dragen opbrengsten", "Produits à reporter"),

  // --- Income statement ---
  "70/76A": L("Operating income", "Bedrijfsopbrengsten", "Produits d’exploitation"),
  "70": L("Turnover", "Omzet", "Chiffre d’affaires"),
  "71": L(
    "Increase (decrease) in stocks of finished goods, work and contracts in progress",
    "Voorraad goederen in bewerking en gereed product en bestellingen in uitvoering: toename (afname)",
    "Variation des stocks de produits finis, d’en-cours de fabrication et de commandes en cours d’exécution",
  ),
  "72": L("Own construction capitalised", "Geproduceerde vaste activa", "Production immobilisée"),
  "73": L("Membership fees, donations, bequests and grants", "Lidgeld, schenkingen, legaten en subsidies", "Cotisations, dons, legs et subsides"),
  "73/74": L("Other operating income", "Andere bedrijfsopbrengsten", "Autres produits d’exploitation"),
  "74": L("Other operating income", "Andere bedrijfsopbrengsten", "Autres produits d’exploitation"),
  "76A": L("Non-recurring operating income", "Niet-recurrente bedrijfsopbrengsten", "Produits d’exploitation non récurrents"),
  "60/66A": L("Operating charges", "Bedrijfskosten", "Charges d’exploitation"),
  "60": L("Raw materials, consumables and goods for resale", "Handelsgoederen, grond- en hulpstoffen", "Approvisionnements et marchandises"),
  "600/8": L("Purchases", "Aankopen", "Achats"),
  "609": L("Decrease (increase) in inventories", "Voorraad: afname (toename)", "Réduction (augmentation) des stocks"),
  "61": L("Services and other goods", "Diensten en diverse goederen", "Services et biens divers"),
  "62": L("Remuneration, social security costs and pensions", "Bezoldigingen, sociale lasten en pensioenen", "Rémunérations, charges sociales et pensions"),
  "630": L(
    "Depreciation of and other amounts written off formation expenses, intangible and tangible fixed assets",
    "Afschrijvingen en waardeverminderingen op oprichtingskosten, op immateriële en materiële vaste activa",
    "Amortissements et réductions de valeur sur frais d’établissement, sur immobilisations incorporelles et corporelles",
  ),
  "631/4": L(
    "Amounts written off inventories, contracts in progress and trade debtors",
    "Waardeverminderingen op voorraden, bestellingen in uitvoering en handelsvorderingen",
    "Réductions de valeur sur stocks, sur commandes en cours d’exécution et sur créances commerciales",
  ),
  "635/8": L(
    "Provisions for liabilities and charges: appropriations (uses and write-backs)",
    "Voorzieningen voor risico’s en kosten: toevoegingen (bestedingen en terugnemingen)",
    "Provisions pour risques et charges: dotations (utilisations et reprises)",
  ),
  "640/8": L("Other operating charges", "Andere bedrijfskosten", "Autres charges d’exploitation"),
  "649": L("Operating charges carried to assets as restructuring costs", "Als herstructureringskosten geactiveerde bedrijfskosten", "Charges d’exploitation portées à l’actif au titre de frais de restructuration"),
  "66A": L("Non-recurring operating charges", "Niet-recurrente bedrijfskosten", "Charges d’exploitation non récurrentes"),
  "9900": L("Gross operating margin", "Brutomarge", "Marge brute"),
  "9901": L("Operating profit (loss)", "Bedrijfsresultaat", "Bénéfice (Perte) d’exploitation"),
  "75/76B": L("Financial income", "Financiële opbrengsten", "Produits financiers"),
  "75": L("Recurring financial income", "Recurrente financiële opbrengsten", "Produits financiers récurrents"),
  "750": L("Income from financial fixed assets", "Opbrengsten uit financiële vaste activa", "Produits des immobilisations financières"),
  "751": L("Income from current assets", "Opbrengsten uit vlottende activa", "Produits des actifs circulants"),
  "752/9": L("Other financial income", "Andere financiële opbrengsten", "Autres produits financiers"),
  "76B": L("Non-recurring financial income", "Niet-recurrente financiële opbrengsten", "Produits financiers non récurrents"),
  "65/66B": L("Financial charges", "Financiële kosten", "Charges financières"),
  "65": L("Recurring financial charges", "Recurrente financiële kosten", "Charges financières récurrentes"),
  "650": L("Debt charges", "Kosten van schulden", "Charges des dettes"),
  "651": L("Amounts written off current assets", "Waardeverminderingen op vlottende activa", "Réductions de valeur sur actifs circulants"),
  "652/9": L("Other financial charges", "Andere financiële kosten", "Autres charges financières"),
  "66B": L("Non-recurring financial charges", "Niet-recurrente financiële kosten", "Charges financières non récurrentes"),
  "9902": L("Profit (Loss) on ordinary activities before taxes", "Winst (Verlies) uit de gewone bedrijfsuitoefening vóór belasting", "Bénéfice (Perte) courant(e) avant impôts"),
  "9903": L("Profit (Loss) for the period before taxes", "Winst (Verlies) van het boekjaar vóór belasting", "Bénéfice (Perte) de l’exercice avant impôts"),
  "67/77": L("Income taxes", "Belastingen op het resultaat", "Impôts sur le résultat"),
  "67": L("Income taxes", "Belastingen", "Impôts"),
  "670/3": L("Taxes", "Belastingen", "Impôts"),
  "77": L("Adjustment of income taxes and write-back of tax provisions", "Regularisering van belastingen en terugneming van fiscale voorzieningen", "Régularisations d’impôts et reprises de provisions fiscales"),
  "9904": L("Profit (Loss) of the period", "Winst (Verlies) van het boekjaar", "Bénéfice (Perte) de l’exercice"),
  "780": L("Transfer from deferred taxes", "Onttrekking aan de uitgestelde belastingen", "Prélèvements sur les impôts différés"),
  "680": L("Transfer to deferred taxes", "Overboeking naar de uitgestelde belastingen", "Transfert aux impôts différés"),
  "789": L("Transfer from untaxed reserves", "Onttrekking aan de belastingvrije reserves", "Prélèvements sur les réserves immunisées"),
  "689": L("Transfer to untaxed reserves", "Overboeking naar de belastingvrije reserves", "Transfert aux réserves immunisées"),
  "9905": L("Profit (Loss) of the period to be appropriated", "Te bestemmen winst (verlies) van het boekjaar", "Bénéfice (Perte) de l’exercice à affecter"),
  "9906": L("Profit (Loss) to be appropriated", "Te bestemmen winst (verlies)", "Bénéfice (Perte) à affecter"),

  // --- Appropriation ---
  "9907": L("Accumulated profit (loss) of the previous period", "Overgedragen winst (verlies) van het vorige boekjaar", "Bénéfice (Perte) reporté(e) de l’exercice précédent"),
  "791/2": L("Transfers from equity", "Onttrekking aan het eigen vermogen", "Prélèvements sur les capitaux propres"),
  "791": L("Transfers from capital and share premium account", "Onttrekking aan het kapitaal en aan de uitgiftepremies", "Prélèvements sur le capital et les primes d’émission"),
  "792": L("Transfers from reserves", "Onttrekking aan de reserves", "Prélèvements sur les réserves"),
  "9908": L("Profit to be appropriated / Loss to be carried forward", "Te bestemmen winst / Te verwerken verlies", "Bénéfice à affecter / Perte à reporter"),
  "691/2": L("Transfers to equity", "Toevoeging aan het eigen vermogen", "Affectations aux capitaux propres"),
  "691": L("Transfers to capital and share premium account", "Toevoeging aan het kapitaal en aan de uitgiftepremies", "Affectation au capital et aux primes d’émission"),
  "6920": L("Transfers to the legal reserve", "Toevoeging aan de wettelijke reserve", "Affectation à la réserve légale"),
  "6921": L("Transfers to other reserves", "Toevoeging aan de overige reserves", "Affectation aux autres réserves"),
  "794": L("Contribution of partners towards the loss", "Tussenkomst van de vennoten in het verlies", "Intervention des associés dans la perte"),
  "694/7": L("Profit to be distributed", "Uit te keren winst", "Bénéfice à distribuer"),
  "694/6": L("Profit to be distributed", "Uit te keren winst", "Bénéfice à distribuer"),
  "694": L("Dividends", "Vergoeding van het kapitaal", "Rémunération du capital"),
  "695": L("Directors’ or managers’ entitlements", "Bestuurders of zaakvoerders", "Administrateurs ou gérants"),
  "696": L("Other allocations", "Andere rechthebbenden", "Autres allocataires"),
  "697": L("Other allocations", "Andere rechthebbenden", "Autres allocataires"),
};

/** Trim and collapse spaces around `/` so "130 / 1" matches key "130/1". */
export function normalizeMarCode(code: string): string {
  return code.trim().replace(/\s*\/\s*/g, "/");
}

function lookupEntry(code: string): MarLabel | undefined {
  const key = normalizeMarCode(code);
  if (!key) return undefined;
  if (MAR_LABELS[key]) return MAR_LABELS[key];
  for (const alias of MAR_LABEL_ALIASES[key] ?? []) {
    const entry = MAR_LABELS[alias];
    if (entry) return entry;
  }
  return undefined;
}

/** Officiële NBB-omschrijving (NL) for this exact code, or null if unknown. */
export function nbbGlossaryLabel(code: string): string | null {
  const entry = lookupEntry(code);
  return entry?.nl ?? null;
}
