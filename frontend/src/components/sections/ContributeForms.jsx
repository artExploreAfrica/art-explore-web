import { useId, useMemo, useState } from "react";
import { apiPost } from "../../lib/api";
import { useGalleries } from "../../hooks/useGalleries";
import {
  DAYS,
  emptyHours,
  formatInstitutionType,
  hoursToApi,
  INSTITUTION_TYPES,
  parseGeocode,
} from "../../admin/institutionShared";

/**
 * The three forms behind the contribute section's intent step:
 *   EnquiryForm     — options A and B ("Reach out", "Learn more") → /enquiries
 *   ExhibitionForm  — option C › "Add an Exhibition" → /submissions/exhibitions/public
 *   SpaceForm       — option C › "Add a New Space"   → /submissions/public
 *
 * None needs an account. Each has the hidden `company` honeypot, and every
 * submission lands for an admin to review: enquiries in the Enquiries inbox,
 * exhibitions and spaces PENDING in Submissions.
 */

const AREAS = [
  { value: "ISLAND", label: "Island" },
  { value: "MAINLAND", label: "Mainland" },
  { value: "OTHER", label: "Elsewhere in Lagos" },
];

// "More specifically" for an Art Hub/Institution. The other types imply their
// sub-type (an Art Gallery is a gallery), so they don't ask.
const HUB_SUBTYPES = [
  { value: "CULTURAL_SPACE", label: "Cultural space" },
  { value: "FOUNDATION", label: "Foundation" },
  { value: "INSTITUTE", label: "Institute" },
  { value: "STUDIO", label: "Studio" },
  { value: "ONLINE", label: "Online" },
];
const IMPLIED_SUBTYPE = { ART_GALLERY: "ART_GALLERY", MUSEUM: "MUSEUM", ART_FESTIVAL: "ART_FESTIVAL" };

const withScheme = (url) => (url && !/^https?:\/\//i.test(url) ? `https://${url}` : url);

/** Trim strings and drop empty ones — the API rejects "" for URLs and emails. */
function clean(values) {
  const out = {};
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === "string") {
      const t = v.trim();
      if (t) out[k] = t;
    } else if (v !== undefined && v !== null) {
      out[k] = v;
    }
  }
  return out;
}

/** Shared submit state: idle | sending | sent | error. */
function useSubmit(path) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const send = async (payload) => {
    setStatus("sending");
    setError("");
    try {
      await apiPost(path, payload);
      setStatus("sent");
      return true;
    } catch (err) {
      setStatus("error");
      setError(err.message);
      return false;
    }
  };
  return { status, error, send, reset: () => setStatus("idle") };
}

/** Text field bound to `form[key]`. */
function useFields(initial) {
  const [form, setForm] = useState(initial);
  const id = useId();
  const field = (key) => ({
    id: `${id}-${key}`,
    name: key,
    value: form[key],
    onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });
  return { form, setForm, field, id };
}

/** A label wrapping its control, as the original form did. */
function Field({ label, required, wide, hint, children }) {
  return (
    <label className={`ct__field${wide ? " ct__field--wide" : ""}`}>
      <span>
        {label} {required && <abbr title="required">*</abbr>}
      </span>
      {children}
      {hint && <small className="ct__field-hint">{hint}</small>}
    </label>
  );
}

function Honeypot({ field }) {
  return (
    // Hidden from people and assistive tech; bots fill it.
    <div className="ct__hp" aria-hidden="true">
      <label htmlFor={field.id}>Company</label>
      <input {...field} tabIndex={-1} autoComplete="off" />
    </div>
  );
}

function Footer({ status, error, label, hint }) {
  return (
    <>
      {hint && <p className="ct__hint">{hint}</p>}
      {status === "error" && (
        <p className="ct__error" role="alert">
          Couldn’t send that — {error}
        </p>
      )}
      <button type="submit" className="ct__submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : label}
      </button>
    </>
  );
}

function Done({ title, text, again, onAgain }) {
  return (
    <div className="ct__done" role="status">
      <p className="ct__done-title">{title}</p>
      <p className="ct__done-text">{text}</p>
      <button type="button" className="ct__again" onClick={onAgain}>
        {again}
      </button>
    </div>
  );
}

// ── A / B — Reach out, Learn more ─────────────────────────────
const ENQUIRY_COPY = {
  REACH_OUT: {
    message: "How can we help?",
    placeholder: "Partnerships, press, a correction, or anything else.",
    submit: "Send message",
  },
  LEARN_MORE: {
    message: "What would you like to know?",
    placeholder: "About Art Explore, listing a space, how the guide is put together…",
    submit: "Send question",
  },
};

export function EnquiryForm({ intent }) {
  const empty = { name: "", email: "", organisation: "", message: "", company: "" };
  const { form, setForm, field } = useFields(empty);
  const { status, error, send, reset } = useSubmit("/enquiries");
  const copy = ENQUIRY_COPY[intent];

  if (status === "sent") {
    return (
      <Done
        title="Thank you — your message is with the team."
        text="We read every one and will reply by email."
        again="Send another message"
        onAgain={reset}
      />
    );
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    if (await send({ intent, ...clean(form) })) setForm(empty);
  };

  return (
    <form className="ct__form" onSubmit={onSubmit}>
      <div className="ct__grid">
        <Field label="Your name" required>
          <input {...field("name")} required maxLength={100} autoComplete="name" />
        </Field>
        <Field label="Your email" required>
          <input {...field("email")} type="email" required maxLength={200} autoComplete="email" />
        </Field>
        <Field label="Organisation" wide hint="Gallery, studio, publication or brand — if you’re writing for one.">
          <input {...field("organisation")} maxLength={200} autoComplete="organization" />
        </Field>
        <Field label={copy.message} required wide>
          <textarea {...field("message")} rows={5} required maxLength={2000} placeholder={copy.placeholder} />
        </Field>
        <Honeypot field={field("company")} />
      </div>
      <Footer status={status} error={error} label={copy.submit} />
    </form>
  );
}

// ── C › Add an Exhibition ────────────────────────────────────
export function ExhibitionForm({ onAddSpace }) {
  const empty = {
    venue: "",
    name: "",
    startDate: "",
    endDate: "",
    startTime: "10:00",
    endTime: "18:00",
    link: "",
    description: "",
    submitterName: "",
    submitterEmail: "",
    company: "",
  };
  const { form, setForm, field, id } = useFields(empty);
  const { status, error, send, reset } = useSubmit("/submissions/exhibitions/public");
  const { galleries, loading } = useGalleries();

  // The visitor types a venue name; it must match one on the site.
  const venues = useMemo(
    () => [...galleries].sort((a, b) => a.name.localeCompare(b.name)),
    [galleries],
  );
  const venue = venues.find((g) => g.name.toLowerCase() === form.venue.trim().toLowerCase());
  const venueUnknown = form.venue.trim().length > 2 && !venue && !loading;

  if (status === "sent") {
    return (
      <Done
        title="Thank you — the exhibition is with us."
        text="We’ll check the details and list it once it’s reviewed."
        again="Add another exhibition"
        onAgain={reset}
      />
    );
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!venue) return;
    const { venue: _venue, link, ...rest } = form;
    const ok = await send({ ...clean(rest), link: withScheme(link.trim()) || undefined, institutionId: venue.id });
    if (ok) setForm(empty);
  };

  return (
    <form className="ct__form" onSubmit={onSubmit}>
      <div className="ct__grid">
        <Field
          label="Venue"
          required
          wide
          hint={loading ? "Loading venues…" : "Start typing and pick the venue from the list."}
        >
          <input
            {...field("venue")}
           
            list={`${id}-venues`}
            required
            autoComplete="off"
            aria-invalid={venueUnknown || undefined}
          />
          <datalist id={`${id}-venues`}>
            {venues.map((g) => (
              <option key={g.id} value={g.name} />
            ))}
          </datalist>
        </Field>
        {venueUnknown && (
          <p className="ct__notice ct__field--wide" role="status">
            That venue isn’t on the guide yet.{" "}
            <button type="button" className="ct__link" onClick={onAddSpace}>
              Add it as a new space
            </button>{" "}
            first, then add its exhibition.
          </p>
        )}

        <Field label="Exhibition title" required wide>
          <input {...field("name")} required maxLength={200} autoComplete="off" />
        </Field>
        <Field label="Opens" required>
          <input {...field("startDate")} type="date" required />
        </Field>
        <Field label="Closes" required>
          <input {...field("endDate")} type="date" required min={form.startDate || undefined} />
        </Field>
        <Field label="Daily from" required>
          <input {...field("startTime")} type="time" required />
        </Field>
        <Field label="Until" required>
          <input {...field("endTime")} type="time" required />
        </Field>
        <Field label="Link" wide hint="The exhibition page, press release or post.">
          <input {...field("link")} inputMode="url" maxLength={300} placeholder="example.com/exhibition" />
        </Field>
        <Field label="About the exhibition" wide>
          <textarea {...field("description")} rows={3} maxLength={2000} placeholder="Artists, theme, anything a visitor should know." />
        </Field>
        <Field label="Your name">
          <input {...field("submitterName")} maxLength={100} autoComplete="name" />
        </Field>
        <Field label="Your email">
          <input {...field("submitterEmail")} type="email" maxLength={200} autoComplete="email" />
        </Field>
        <Honeypot field={field("company")} />
      </div>
      <Footer
        status={status}
        error={error}
        label="Send exhibition"
        hint="Your name and email are optional — only so we can follow up."
      />
    </form>
  );
}

// ── C › Add a New Space ──────────────────────────────────────

/** Visitor-friendly hours row: not sure / closed / open with times. */
function HoursEditor({ hours, setHours, id }) {
  const stateOf = (row) => (!row.recorded ? "unknown" : row.closed ? "closed" : "open");
  const setState = (key, value) =>
    setHours((h) => ({
      ...h,
      [key]: { ...h[key], recorded: value !== "unknown", closed: value === "closed" },
    }));
  const setTime = (key, part, value) =>
    setHours((h) => ({ ...h, [key]: { ...h[key], [part]: value } }));

  return (
    <fieldset className="ct__hours ct__field--wide">
      <legend>Opening hours</legend>
      <p className="ct__field-hint">Leave a day as “Not sure” if you don’t know it.</p>
      {DAYS.map(({ key, label }) => {
        const row = hours[key];
        const state = stateOf(row);
        return (
          <div className="ct__hours-row" key={key}>
            <label htmlFor={`${id}-day-${key}`} className="ct__hours-day">
              {label}
            </label>
            <select id={`${id}-day-${key}`} value={state} onChange={(e) => setState(key, e.target.value)}>
              <option value="unknown">Not sure</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
            {state === "open" && (
              <span className="ct__hours-times">
                <input
                  type="time"
                  aria-label={`${label} opens`}
                  value={row.open}
                  onChange={(e) => setTime(key, "open", e.target.value)}
                />
                <span aria-hidden="true">–</span>
                <input
                  type="time"
                  aria-label={`${label} closes`}
                  value={row.close}
                  onChange={(e) => setTime(key, "close", e.target.value)}
                />
              </span>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}

export function SpaceForm() {
  const empty = {
    name: "",
    type: "",
    subType: "",
    area: "",
    address: "",
    subArea: "",
    mapUrl: "",
    coordinates: "",
    website: "",
    instagram: "",
    phone: "",
    email: "",
    description: "",
    photoLinks: "",
    submitterName: "",
    submitterEmail: "",
    company: "",
  };
  const { form, setForm, field, id } = useFields(empty);
  const [hours, setHours] = useState(emptyHours);
  const [hasResidency, setHasResidency] = useState(false);
  const [localError, setLocalError] = useState("");
  const { status, error, send, reset } = useSubmit("/submissions/public");

  if (status === "sent") {
    return (
      <Done
        title="Thank you — it’s with us."
        text="We’ll check the details and add it to the map once it’s reviewed."
        again="Add another space"
        onAgain={reset}
      />
    );
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");

    const { coordinates, photoLinks, subType, ...rest } = form;
    let coords = {};
    if (coordinates.trim()) {
      const parsed = parseGeocode(coordinates);
      if (!parsed) {
        setLocalError("Coordinates should look like “6.4531, 3.3958” — or leave them blank.");
        return;
      }
      coords = { lat: Number(parsed.lat), lng: Number(parsed.lng) };
    }
    const links = photoLinks
      .split(/\s+/)
      .map((l) => withScheme(l.trim()))
      .filter(Boolean);
    if (links.length > 5) {
      setLocalError("Up to five photo links, please.");
      return;
    }

    const payload = {
      ...clean(rest),
      ...coords,
      subType: (form.type === "HUB_INSTITUTION" ? subType : IMPLIED_SUBTYPE[form.type]) || undefined,
      website: withScheme(rest.website.trim()) || undefined,
      mapUrl: withScheme(rest.mapUrl.trim()) || undefined,
      openingHours: hoursToApi(hours) ?? undefined,
      hasResidency: hasResidency || undefined,
      photoLinks: links.length ? links : undefined,
    };
    if (await send(payload)) {
      setForm(empty);
      setHours(emptyHours());
      setHasResidency(false);
    }
  };

  return (
    <form className="ct__form" onSubmit={onSubmit}>
      <p className="ct__group">The space</p>
      <div className="ct__grid">
        <Field label="Name" required wide>
          <input {...field("name")} required maxLength={200} autoComplete="off" />
        </Field>
        <Field label="Kind of space" required>
          <select {...field("type")} required>
            <option value="" disabled>
              Choose one
            </option>
            {INSTITUTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {formatInstitutionType(t)}
              </option>
            ))}
          </select>
        </Field>
        {form.type === "HUB_INSTITUTION" ? (
          <Field label="More specifically">
            <select {...field("subType")}>
              <option value="">Not sure</option>
              {HUB_SUBTYPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <span aria-hidden="true" />
        )}
        <Field label="About the space" wide hint="What it shows, who runs it, what a visitor can expect.">
          <textarea {...field("description")} rows={3} maxLength={2000} />
        </Field>
        <label className="ct__check ct__field--wide">
          <input type="checkbox" checked={hasResidency} onChange={(e) => setHasResidency(e.target.checked)} />
          Runs an artist residency
        </label>
      </div>

      <p className="ct__group">Where it is</p>
      <div className="ct__grid">
        <Field label="Address" required wide>
          <input {...field("address")} required maxLength={300} autoComplete="off" />
        </Field>
        <Field label="Area" required>
          <select {...field("area")} required>
            <option value="" disabled>
              Choose one
            </option>
            {AREAS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Neighbourhood">
          <input {...field("subArea")} maxLength={100} placeholder="e.g. Ikoyi, Yaba" />
        </Field>
        <Field label="Google Maps link" hint="Share → Copy link, in Google Maps.">
          <input {...field("mapUrl")} inputMode="url" maxLength={500} placeholder="maps.app.goo.gl/…" />
        </Field>
        <Field label="Coordinates" hint="Optional. Right-click the pin in Google Maps to copy them.">
          <input {...field("coordinates")} inputMode="decimal" maxLength={60} placeholder="6.4531, 3.3958" />
        </Field>
      </div>

      <p className="ct__group">Contact and hours</p>
      <div className="ct__grid">
        <Field label="Website">
          <input {...field("website")} inputMode="url" maxLength={300} placeholder="example.com" />
        </Field>
        <Field label="Instagram">
          <input {...field("instagram")} maxLength={100} placeholder="@handle" />
        </Field>
        <Field label="Phone">
          <input {...field("phone")} type="tel" maxLength={50} autoComplete="off" />
        </Field>
        <Field label="Email">
          <input {...field("email")} type="email" maxLength={200} autoComplete="off" />
        </Field>
        <HoursEditor hours={hours} setHours={setHours} id={id} />
        <Field
          label="Photo links"
          wide
          hint="Up to five links to photos of the space (website, Instagram, Google Drive), one per line."
        >
          <textarea {...field("photoLinks")} rows={3} maxLength={2600} />
        </Field>
      </div>

      <p className="ct__group">About you</p>
      <div className="ct__grid">
        <Field label="Your name">
          <input {...field("submitterName")} maxLength={100} autoComplete="name" />
        </Field>
        <Field label="Your email">
          <input {...field("submitterEmail")} type="email" maxLength={200} autoComplete="email" />
        </Field>
        <Honeypot field={field("company")} />
      </div>

      {localError && (
        <p className="ct__error" role="alert">
          {localError}
        </p>
      )}
      <Footer
        status={status}
        error={error}
        label="Send new space"
        hint="Your name and email are optional — only so we can follow up."
      />
    </form>
  );
}
