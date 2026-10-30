import { useEffect, useId, useRef, useState } from "react";
import { EnquiryForm, ExhibitionForm, SpaceForm } from "./ContributeForms";
import "./Contribute.scss";

/**
 * "Get involved" — the home page's one door for writing in.
 *
 * The button drops a panel open in place. A visitor first says why they're
 * here, then gets the form for it:
 *   A  Reach out              → message to the team (admin › Enquiries)
 *   B  Learn more             → question to the team (admin › Enquiries)
 *   C  Add a cultural space   → then: Add an Exhibition | Add a New Space
 *                               (admin › Submissions, PENDING for review)
 * No account needed for any of them. The forms live in ContributeForms.jsx.
 */

const INTENTS = [
  {
    id: "reach",
    letter: "A",
    title: "Reach out",
    text: "Partnerships, press, a correction, or a question for the team.",
  },
  {
    id: "learn",
    letter: "B",
    title: "Learn more",
    text: "Find out what Art Explore is and how the guide comes together.",
  },
  {
    id: "add",
    letter: "C",
    title: "Add a cultural space",
    text: "Put a new venue, or an exhibition at one, on the map.",
  },
];

const ADD_OPTIONS = [
  {
    id: "exhibition",
    title: "Add an Exhibition",
    text: "A show at a venue that’s already on the guide.",
  },
  {
    id: "space",
    title: "Add a New Space",
    text: "A gallery, museum, hub or other space we haven’t listed.",
  },
];

// Heading and back-target for every step after the first.
const STEPS = {
  reach: { title: "Reach out", back: "intent" },
  learn: { title: "Learn more", back: "intent" },
  add: { title: "Add a cultural space", back: "intent" },
  exhibition: { title: "Add an Exhibition", back: "add" },
  space: { title: "Add a New Space", back: "add" },
};

const Arrow = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path
      d="M2 7h10M8 3l4 4-4 4"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

function Choices({ options, onPick, label }) {
  return (
    <div className="ct__choices" role="list" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="listitem" className="ct__choice" onClick={() => onPick(o.id)}>
          {o.letter && (
            <span className="ct__choice-letter" aria-hidden="true">
              {o.letter}
            </span>
          )}
          <span className="ct__choice-title">{o.title}</span>
          <span className="ct__choice-text">{o.text}</span>
          <span className="ct__choice-go" aria-hidden="true">
            <Arrow />
          </span>
        </button>
      ))}
    </div>
  );
}

export default function Contribute() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("intent");
  const stepHeading = useRef(null);
  const id = useId();
  const panelId = `${id}-panel`;

  // Each step change moves focus to its heading, so keyboard and screen
  // reader users land on the new content rather than a vanished button.
  useEffect(() => {
    if (open) stepHeading.current?.focus();
  }, [open, step]);

  const meta = STEPS[step];

  return (
    <section className="ct" id="contribute" aria-labelledby="ct-title">
      <h2 className="ct__title" id="ct-title">
        Help us map <em>Lagos art.</em>
      </h2>
      <p className="ct__lede">
        Get in touch with the team, find out more, or add a space or an
        exhibition to the guide.
      </p>

      <button
        type="button"
        className={`ct__btn${open ? " ct__btn--open" : ""}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        Get involved <Arrow />
      </button>
      {!open && <p className="ct__note">No account needed. It takes a minute.</p>}

      <div className={`ct__panel${open ? " ct__panel--open" : ""}`} id={panelId} hidden={!open}>
        {step === "intent" ? (
          <>
            <h3 className="ct__step" ref={stepHeading} tabIndex={-1}>
              What brings you here?
            </h3>
            <Choices options={INTENTS} onPick={setStep} label="What brings you here?" />
          </>
        ) : (
          <>
            <div className="ct__step-bar">
              <button type="button" className="ct__back" onClick={() => setStep(meta.back)}>
                <span aria-hidden="true">←</span> Back
              </button>
              <h3 className="ct__step" ref={stepHeading} tabIndex={-1}>
                {meta.title}
              </h3>
            </div>

            {step === "reach" && <EnquiryForm intent="REACH_OUT" />}
            {step === "learn" && <EnquiryForm intent="LEARN_MORE" />}
            {step === "add" && (
              <Choices options={ADD_OPTIONS} onPick={setStep} label="What would you like to add?" />
            )}
            {step === "exhibition" && <ExhibitionForm onAddSpace={() => setStep("space")} />}
            {step === "space" && <SpaceForm />}
          </>
        )}
      </div>
    </section>
  );
}
