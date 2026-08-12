import type { Profile } from "../types/profile";

export function makeSampleProfile(): Profile {
  const now = Date.now();
  return {
    identity: {
      legalName: {
        first: "Test",
        middle: "Q",
        last: "User",
        preferred: "Testy",
      },
      contact: {
        email: "test.user@example.com",
        phone: "+1-555-0142",
        phoneType: "Mobile",
        address: {
          street: "123 Sample St",
          city: "Nashville",
          state: "TN",
          zip: "37203",
          country: "United States",
          county: "Davidson",
        },
      },
      demographics: {
        gender: "Decline to answer",
        pronouns: "they/them",
        raceEthnicity: ["Decline to answer"],
        disabilityStatus: "No",
        veteranStatus: "No",
      },
      workAuth: {
        citizenshipStatus: "US Citizen",
        requiresSponsorship: false,
        authorizedToWorkInUS: true,
      },
      eeo: {
        "Are you legally authorized to work in the United States?": "Yes",
        "Will you now or in the future require sponsorship?": "No",
      },
    },
    resumes: [
      {
        id: crypto.randomUUID(),
        name: "Backend SWE",
        createdAt: now,
        updatedAt: now,
        parsedData: {
          school: "Vanderbilt University",
          gpa: "3.8",
          graduationDate: "2026-05",
          experiences: [
            {
              company: "Acme Corp",
              title: "Backend Engineering Intern",
              startDate: "2025-05",
              endDate: "2025-08",
              description:
                "Built a Go service that ingested 50M events/day from Kafka into ClickHouse.",
            },
          ],
          projects: [
            {
              name: "QuickApply",
              description: "Chrome extension that autofills job applications.",
              url: "https://github.com/grcfu/quickapply",
            },
          ],
          skills: ["TypeScript", "Go", "Python", "PostgreSQL", "React"],
        },
        originalFile: {
          filename: "test_user_backend_swe.pdf",
          contentBase64: "VGVzdCByZXN1bWUgY29udGVudA==",
          mimeType: "application/pdf",
        },
      },
    ],
    answers: [
      {
        id: crypto.randomUUID(),
        question: "Why are you interested in this role?",
        answer:
          "I'm drawn to teams that own backend systems end-to-end and care about reliability. Your scale and tooling investments stood out.",
        tags: ["motivation", "generic"],
        createdAt: now,
      },
    ],
    settings: {
      llmProvider: "none",
      tonePreference: "concise, friendly, no buzzwords",
    },
    metadata: {
      createdAt: now,
      lastUpdatedAt: now,
      version: 1,
    },
  };
}
