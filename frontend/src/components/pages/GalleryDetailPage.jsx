import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../layout/Navbar.jsx";
import Footer from "../layout/Footer.jsx";
import { apiGet } from "../../lib/api";
import { adaptInstitution } from "../../lib/adapters";
import { getInitials, placeholderColor } from "../../lib/placeholder";
import { DAYS, formatOpeningHours, formatTypeWithSubType } from "../../admin/institutionShared";
import "./GalleryDetailPage.scss";

/**
 * /galleries/:id — one space's own page.
 *
 * Reached from a card in the directory. It asks the backend for that one
 * record (GET /institutions/:id), so a refresh or a shared link works without
 * the directory having loaded first. Only what the database holds is shown:
 * a field with no value is left out, never filled in.
 */

const AREA_LABEL = { ISLAND: "Island", MAINLAND: "Mainland", OTHER: "Other" };

// These values are free text in the database, so only http(s) is ever linked.
function webUrl(value) {
  const v = (value ?? "").trim();
  if (!v) return null;
  const url = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

// "@handle", "handle" or a full instagram.com URL all become a profile link.
function instagramUrl(value) {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return webUrl(v);
  return `https://www.instagram.com/${v.replace(/^@/, "").replace(/\/$/, "")}`;
}

function instagramHandle(value) {
  const v = value.trim();
  const fromUrl = v.match(/instagram\.com\/([^/?#]+)/i);
  return `@${(fromUrl ? fromUrl[1] : v).replace(/^@/, "")}`;
}

const bareUrl = (url) => url.replace(/^https?:\/\//i, "").replace(/\/$/, "");

const NOT_LISTED = "Not listed";

// Monday to Sunday, in order, with neighbouring days that share the same hours
// merged: "Mon – Fri  10:00 – 18:00". A day the database holds nothing for reads
// "Not listed" — never a guess. No hours at all gives [] (the panel's own note).
function groupHours(openingHours) {
  const recorded = new Map(formatOpeningHours(openingHours).map((h) => [h.label, h.value]));
  if (recorded.size === 0) return [];

  const runs = [];
  for (const { label } of DAYS) {
    const day = label.slice(0, 3);
    const value = recorded.get(label) ?? NOT_LISTED;
    const last = runs[runs.length - 1];
    if (last && last.value === value) last.to = day;
    else runs.push({ from: day, to: day, value });
  }
  return runs.map(({ from, to, value }) => ({
    label: from === to ? from : `${from} – ${to}`,
    value,
  }));
}

function Row({ label, muted, children }) {
  return (
    <div className={`gd__row${muted ? " gd__row--muted" : ""}`}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Panel({ title, empty, children }) {
  return (
    <section className="gd__panel">
      <h2 className="gd__panel-title">{title}</h2>
      {children ?? <p className="gd__muted">{empty}</p>}
    </section>
  );
}

function Detail({ gallery: g, area }) {
  // Real tags only, A to Z — the same order the directory cards use.
  const tags = [...(g.tags ?? [])].sort((a, b) => a.label.localeCompare(b.label));
  const hours = groupHours(g.openingHours);
  const website = webUrl(g.website);
  const instagram = instagramUrl(g.instagram);
  const email = (g.email ?? "").trim();
  const phone = (g.phone ?? "").trim();
  const mapUrl = webUrl(g.mapUrl);
  const areaLabel = AREA_LABEL[area];

  const hasLocation = g.address || areaLabel || g.subArea || mapUrl;
  const hasContact = website || instagram || email || phone;

  return (
    <article>
      <header className="gd__head">
        <p className="gd__eyebrow">
          <span className="gd__eyebrow-rule" aria-hidden="true" />
          {formatTypeWithSubType(g.type, g.subType)}
        </p>
        <h1 className="gd__title">{g.name}</h1>
        {g.rating != null && (
          <p className="gd__rating">
            <span aria-hidden="true">★</span> {g.rating.toFixed(1)}
            {g.reviewCount > 0 && (
              <span className="gd__muted">
                {" "}
                · {g.reviewCount} review{g.reviewCount === 1 ? "" : "s"}
              </span>
            )}
          </p>
        )}
      </header>

      <div className="gd__grid">
        <div className="gd__main">
          <div
            className="gd__cover"
            style={g.image ? undefined : { backgroundColor: placeholderColor(g.name) }}
          >
            {g.image ? (
              <img src={g.image} alt={g.name} className="gd__img" />
            ) : (
              <span className="gd__initials" aria-hidden="true">
                {getInitials(g.name)}
              </span>
            )}
          </div>

          {g.description ? (
            <p className="gd__description">{g.description}</p>
          ) : (
            <p className="gd__muted">No description has been added yet.</p>
          )}

          {(tags.length > 0 || g.hasExhibition) && (
            <ul className="gd__chips" aria-label="Tags">
              {tags.map((t) => (
                <li key={t.name} className="gd__chip">
                  {t.label}
                </li>
              ))}
              {g.hasExhibition && <li className="gd__chip">Exhibition</li>}
            </ul>
          )}
        </div>

        <aside className="gd__side">
          <Panel title="Location" empty="No location has been listed yet.">
            {hasLocation ? (
              <>
                <dl className="gd__facts">
                  {g.address && <Row label="Address">{g.address}</Row>}
                  {areaLabel && <Row label="Area">{areaLabel}</Row>}
                  {g.subArea && <Row label="Sub-area">{g.subArea}</Row>}
                </dl>
                {mapUrl && (
                  <a className="gd__link" href={mapUrl} target="_blank" rel="noopener noreferrer">
                    Open in Google Maps ↗
                  </a>
                )}
              </>
            ) : null}
          </Panel>

          <Panel title="Contact" empty="No contact details have been listed yet.">
            {hasContact ? (
              <dl className="gd__facts">
                {website && (
                  <Row label="Website">
                    <a className="gd__link" href={website} target="_blank" rel="noopener noreferrer">
                      {bareUrl(website)}
                    </a>
                  </Row>
                )}
                {instagram && (
                  <Row label="Instagram">
                    <a className="gd__link" href={instagram} target="_blank" rel="noopener noreferrer">
                      {instagramHandle(g.instagram)}
                    </a>
                  </Row>
                )}
                {email && (
                  <Row label="Email">
                    <a className="gd__link" href={`mailto:${email}`}>
                      {email}
                    </a>
                  </Row>
                )}
                {phone && (
                  <Row label="Phone">
                    <a className="gd__link" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
                      {phone}
                    </a>
                  </Row>
                )}
              </dl>
            ) : null}
          </Panel>

          <Panel title="Opening hours" empty="Opening hours haven’t been listed yet.">
            {hours.length > 0 ? (
              <dl className="gd__facts gd__facts--hours">
                {hours.map((h) => (
                  <Row key={h.label} label={h.label} muted={h.value === NOT_LISTED}>
                    {h.value}
                  </Row>
                ))}
              </dl>
            ) : null}
          </Panel>
        </aside>
      </div>
    </article>
  );
}

// Same footprint as the loaded page, so nothing jumps when the data arrives.
function Skeleton() {
  return (
    <div aria-hidden="true">
      <div className="gd__skel gd__skel--eyebrow" />
      <div className="gd__skel gd__skel--title" />
      <div className="gd__grid">
        <div className="gd__main">
          <div className="gd__skel gd__skel--cover" />
          <div className="gd__skel gd__skel--line" />
          <div className="gd__skel gd__skel--line gd__skel--short" />
        </div>
        <div className="gd__side">
          <div className="gd__skel gd__skel--panel" />
          <div className="gd__skel gd__skel--panel" />
          <div className="gd__skel gd__skel--panel" />
        </div>
      </div>
    </div>
  );
}

function Notice({ title, text, children }) {
  return (
    <div className="gd__notice" role="alert">
      <h1 className="gd__notice-title">{title}</h1>
      <p className="gd__notice-text">{text}</p>
      {children}
    </div>
  );
}

export default function GalleryDetailPage() {
  const { id } = useParams();
  const [result, setResult] = useState(null); // { id, gallery, area } | { id, gone } | { id, error }
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [id]);

  useEffect(() => {
    let live = true;
    apiGet(`/institutions/${encodeURIComponent(id)}`)
      .then((res) => {
        if (live) setResult({ id, gallery: adaptInstitution(res.data), area: res.data.area });
      })
      .catch((err) => {
        if (!live) return;
        // An unknown, unpublished or malformed id is "not available"; anything
        // else (server down, network) is worth a retry.
        const gone = err.status === 404 || err.status === 400;
        setResult(gone ? { id, gone: true } : { id, error: err.message });
      });
    return () => {
      live = false;
    };
  }, [id, attempt]);

  const retry = () => {
    setResult(null);
    setAttempt((n) => n + 1);
  };

  // A result only counts for the id it was fetched for.
  const settled = result && result.id === id ? result : null;

  let body;
  if (!settled) {
    body = <Skeleton />;
  } else if (settled.gallery) {
    body = <Detail gallery={settled.gallery} area={settled.area} />;
  } else if (settled.gone) {
    body = (
      <Notice
        title="We can’t find that space"
        text="It may have been removed, or it isn’t published yet."
      >
        <Link to="/galleries" className="gd__btn gd__btn--secondary">
          Browse all spaces
        </Link>
      </Notice>
    );
  } else {
    body = (
      <Notice title="We couldn’t load this space" text={settled.error}>
        <button type="button" className="gd__btn gd__btn--primary" onClick={retry}>
          Try again
        </button>
      </Notice>
    );
  }

  return (
    <div className="app">
      <Navbar />
      <main className="gd" aria-busy={!settled}>
        <Link to="/galleries" className="gd__back">
          <span aria-hidden="true">←</span> All spaces
        </Link>
        {body}
      </main>
      <Footer />
    </div>
  );
}
