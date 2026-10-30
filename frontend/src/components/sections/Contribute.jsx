import { useEffect, useId, useRef, useState } from "react";
import { apiPost } from "../../lib/api";
import "./Contribute.scss";

/**
 * "Are we missing a gallery?" — invites visitors to suggest a space.
 *
 * The button drops a short form open in place; no account needed. It
 * posts to /submissions/public, which stores the suggestion PENDING and
 * unpublished for an admin to review (and pin on the map). A hidden
 * honeypot field catches form-filling bots.
 */

const KINDS = [
  { value: "ART_GALLERY", label: "Gallery" },
  { value: "MUSEUM", label: "Museum" },
  { value: "HUB_INSTITUTION", label: "Art Hub/Institution" },
  { value: "NOMADIC_SPACE", label: "Nomadic space" },
  { value: "ART_FESTIVAL", label: "Festival" },
  { value: "RESIDENCY", label: "Residency" },
];

const AREAS = [
  { value: "ISLAND", label: "Island" },
  { value: "MAINLAND", label: "Mainland" },
  { value: "OTHER", label: "Elsewhere in Lagos" },
];

const EMPTY = {
  name: "",
  type: "",
  area: "",
  address: "",
  subArea: "",
  website: "",
  instagram: "",
  description: "",
  submitterName: "",
  submitterEmail: "",
  company: "", // honeypot — hidden from people
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

// Drop empty optional fields (the API rejects "" for website/email) and
// let a visitor type "example.com" without the scheme.
function toPayload(form) {
  const out = {};
  for (const [k, v] of Object.entries(form)) {
    const value = v.trim();
    if (value) out[k] = value;
  }
  if (out.website && !/^https?:\/\//i.test(out.website)) {
    out.website = `https://${out.website}`;
  }
  return out;
}

export default function Contribute() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [error, setError] = useState("");
  const firstField = useRef(null);
  const id = useId();
  const panelId = `${id}-panel`;

  // Move focus into the form when it opens, so keyboard users land there.
  useEffect(() => {
    if (open && status !== "sent") firstField.current?.focus();
  }, [open, status]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus("sending");
    setError("");
    try {
      await apiPost("/submissions/public", toPayload(form));
      setStatus("sent");
      setForm(EMPTY);
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  };

  const field = (key) => ({
    id: `${id}-${key}`,
    name: key,
    value: form[key],
    onChange: set(key),
  });

  return (
    <section className="ct" id="contribute" aria-labelledby="ct-title">
      <h2 className="ct__title" id="ct-title">
        Are we missing <em>a gallery?</em>
      </h2>
      <p className="ct__lede">
        Know a space that isn’t on the map? Send it in and help keep this
        guide to Lagos art up to date.
      </p>

      <button
        type="button"
        className={`ct__btn${open ? " ct__btn--open" : ""}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        Submit a gallery <Arrow />
      </button>
      {!open && <p className="ct__note">No account needed. It takes a minute.</p>}

      <div className={`ct__panel${open ? " ct__panel--open" : ""}`} id={panelId} hidden={!open}>
        {status === "sent" ? (
          <div className="ct__done" role="status">
            <p className="ct__done-title">Thank you — it’s with us.</p>
            <p className="ct__done-text">
              We’ll check the details and add it to the map once it’s reviewed.
            </p>
            <button type="button" className="ct__again" onClick={() => setStatus("idle")}>
              Suggest another
            </button>
          </div>
        ) : (
          <form className="ct__form" onSubmit={onSubmit} noValidate={false}>
            <div className="ct__grid">
              <label className="ct__field ct__field--wide" htmlFor={`${id}-name`}>
                <span>Gallery name <abbr title="required">*</abbr></span>
                <input {...field("name")} ref={firstField} required maxLength={200} autoComplete="off" />
              </label>

              <label className="ct__field" htmlFor={`${id}-type`}>
                <span>Kind of space <abbr title="required">*</abbr></span>
                <select {...field("type")} required>
                  <option value="" disabled>Choose one</option>
                  {KINDS.map((k) => (
                    <option key={k.value} value={k.value}>{k.label}</option>
                  ))}
                </select>
              </label>

              <label className="ct__field" htmlFor={`${id}-area`}>
                <span>Area <abbr title="required">*</abbr></span>
                <select {...field("area")} required>
                  <option value="" disabled>Choose one</option>
                  {AREAS.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </label>

              <label className="ct__field ct__field--wide" htmlFor={`${id}-address`}>
                <span>Address <abbr title="required">*</abbr></span>
                <input {...field("address")} required maxLength={300} autoComplete="off" />
              </label>

              <label className="ct__field" htmlFor={`${id}-subArea`}>
                <span>Neighbourhood</span>
                <input {...field("subArea")} maxLength={100} placeholder="e.g. Ikoyi, Yaba" />
              </label>

              <label className="ct__field" htmlFor={`${id}-website`}>
                <span>Website</span>
                <input {...field("website")} inputMode="url" maxLength={300} placeholder="example.com" />
              </label>

              <label className="ct__field" htmlFor={`${id}-instagram`}>
                <span>Instagram</span>
                <input {...field("instagram")} maxLength={100} placeholder="@handle" />
              </label>

              <label className="ct__field ct__field--wide" htmlFor={`${id}-description`}>
                <span>Anything we should know?</span>
                <textarea {...field("description")} rows={3} maxLength={1000} />
              </label>

              <label className="ct__field" htmlFor={`${id}-submitterName`}>
                <span>Your name</span>
                <input {...field("submitterName")} maxLength={100} autoComplete="name" />
              </label>

              <label className="ct__field" htmlFor={`${id}-submitterEmail`}>
                <span>Your email</span>
                <input {...field("submitterEmail")} type="email" maxLength={200} autoComplete="email" />
              </label>

              {/* Honeypot: hidden from people and assistive tech; bots fill it. */}
              <div className="ct__hp" aria-hidden="true">
                <label htmlFor={`${id}-company`}>Company</label>
                <input {...field("company")} tabIndex={-1} autoComplete="off" />
              </div>
            </div>

            <p className="ct__hint">
              Your name and email are optional — only so we can follow up.
            </p>

            {status === "error" && (
              <p className="ct__error" role="alert">
                Couldn’t send that — {error}
              </p>
            )}

            <button type="submit" className="ct__submit" disabled={status === "sending"}>
              {status === "sending" ? "Sending…" : "Send suggestion"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
