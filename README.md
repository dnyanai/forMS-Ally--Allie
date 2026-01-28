# MS Ally - Voice-First AI Companion for MS Patients

> 🏆 Built for the ElevenLabs + Google Cloud AI Partners Hackathon

**MS Ally** is a voice-enabled AI companion that helps Multiple Sclerosis patients track symptoms, search community experiences, and visualize health patterns—all through natural conversation.

## 🎯 The Problem

Multiple Sclerosis affects nearly 3 million people worldwide. Managing it means constant symptom tracking—but most tools feel like paperwork. When you're already exhausted from the disease, tracking becomes another burden.

## 💡 The Solution

MS Ally lets patients **talk naturally** instead of filling forms:
- 🎤 **Voice Output** - ElevenLabs speaks responses aloud (critical for fatigue/motor difficulties)
- 💬 **Natural Chat** - Powered by Google Gemini
- 🔍 **Community Search** - MCP tools search Reddit for real MS patient experiences
- 🌐 **Web Search** - MCP tools search Google for clinical information
- 📊 **Analytics Dashboard** - Visualize mood, fatigue, and symptom patterns over time
- 📝 **Symptom Tracker** - Log symptoms, medications, and notes

## 🏗️ Architecture

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  React Frontend     │ →   │  FastAPI Backend    │ →   │  MCP Server         │
│  (Cloud Run)        │     │  (Cloud Run)        │     │  (Cloud Run)        │
└─────────────────────┘     └─────────────────────┘     └──────────┬──────────┘
                                     │                             │
                                     ▼                             ▼
                            ┌─────────────────┐          ┌─────────────────┐
                            │  ElevenLabs     │          │  BigQuery       │
                            │  Google Gemini  │          │  (Analytics)    │
                            └─────────────────┘          └─────────────────┘
```

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React, TypeScript, Tailwind CSS |
| Backend | FastAPI, Python |
| Voice | ElevenLabs Text-to-Speech |
| AI | Google Gemini |
| Search | MCP (Model Context Protocol) - Reddit & Google |
| Database | BigQuery |
| Infrastructure | Google Cloud Run |

## 📁 Project Structure

```
forMS-Ally--Allie/
├── frontend/          # React + TypeScript app
├── backend/           # FastAPI server (Gemini, ElevenLabs)
├── mcp-server/        # MCP tools (Reddit search, Google search, BigQuery)
└── README.md
```

## 🚀 Live Demo

- **Frontend**: [https://for-ms-frontend-a66z2lnrya-uw.a.run.app/]

## 📊 Features Demo

### Chat + Voice
Natural conversation with spoken responses via ElevenLabs.

### MCP Search Tools
- "Has anyone in the MS community experienced fatigue in heat?" → Searches Reddit
- "What helps with MS fatigue?" → Searches Google

### Analytics Dashboard
- Average mood & fatigue scores
- Top symptoms ranked
- Medication history
- Full log history with filtering (7/14/30/90 days)

## 🎥 Video Demo

[Watch the 3-minute demo](YOUR_VIDEO_LINK_HERE)

## 👩‍💻 Author

**Dnyanai** - Built with ❤️ for the MS community

## 📄 License

Apache 2.0
