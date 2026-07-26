# Jaarrekening Analyzer

De Jaarrekening Analyzer is een lokale webapplicatie waarmee je een Belgische jaarrekening-PDF kunt uploaden en automatisch financiële inzichten krijgt. De app leest tekst-PDF's in NBB-stijl (zoals gedeponeerd bij de Nationale Bank van België), haalt daar de MAR-codes en bedragen uit, en berekent daarop financiële ratio's. Denk aan liquiditeit, solvabiliteit en rentabiliteit.

Het resultaat toon je in een overzichtelijke interface: de geëxtraheerde balans (activa en passiva), de resultatenrekening, en de berekende ratio's met formule en ontbrekende codes waar data ontbreekt. Alles draait lokaal op je eigen machine; er is geen database en geen cloud-upload.

## Vereisten

- Python 3.11+
- Node.js 18+ (nodig vanaf frontend-stappen)

## Voortgang

| Stap | Onderdeel | Status |
|------|-----------|--------|
| 1 | Projectstructuur + README | klaar |
| 2 | Minimale FastAPI-app (`/api/health`) | klaar |
| 3 | Pydantic schemas | klaar |
| 4 | PDF text detector | klaar |
| 5 | PDF extractor | klaar |
| 6 | MAR aggregator | klaar |
| 7 | Ratio engine + `ratios.yaml` | klaar |
| 8 | Analyzer pipeline | klaar |
| 9 | API routes (`POST /api/analyze`) | klaar |
| 10 | Backend tests | klaar |
| 11–16 | Frontend (React + Vite) | — |
| 17 | End-to-end test | — |

## Snel starten (backend)

```powershell
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Health check: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

API-docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

## Structuur (nu)

```
jaarrekening-analyzer/
├── README.md
└── backend/
    ├── config/
    │   └── ratios.yaml   # 9 financiële ratio's
    ├── requirements.txt
    └── app/
        ├── main.py       # FastAPI + CORS + GET /api/health
        ├── api/
        │   └── routes.py      # /api/health + /api/analyze
        ├── mar/
        │   └── aggregator.py  # MAR-code lookup + expressies
        ├── models/
        │   └── schemas.py  # Pydantic-modellen (AnalysisResult, enz.)
        ├── pdf/
        │   ├── detector.py # tekst vs. gescande PDF
        │   └── extractor.py  # MAR-codes en bedragen uit PDF
        └── ratios/
            └── engine.py   # ratio-berekening uit YAML
        └── services/
            └── analyzer.py # orchestrator: detect → extract → ratios → result
    └── tests/
        ├── conftest.py       # maakt `import app...` mogelijk in pytest
        └── test_extractor.py # golden values + analyzer smoke tests
```

Frontend komt in latere stappen onder `frontend/`.

## Git & GitHub

```powershell
git add .
git status
git commit -m "korte beschrijving van je wijziging"
git push
```

Remote: [github.com/QuintenDes/jaarrekening-analyzer](https://github.com/QuintenDes/jaarrekening-analyzer)
