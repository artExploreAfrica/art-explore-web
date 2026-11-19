import { FiInstagram, FiMail } from "react-icons/fi";
import { EnquiryForm } from "./ContributeForms";
import "./Contribute.scss"; // the form's styles (.ct__form, .ct__field…)
import "./ContactSection.scss";

/**
 * "Contact us" — the last section on the home page, reached from the footer's
 * Contact link (/#contact).
 *
 * The form is the existing "Reach out" enquiry form: no account needed, a
 * honeypot against bots, rate-limited on the server, and every message lands
 * in the admin's Enquiries inbox. Beside it, the direct ways to reach the team
 * — each shown only when its address is configured (same env values as the
 * footer icons).
 */

const INSTAGRAM_URL = import.meta.env.VITE_INSTAGRAM_URL;
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL;

// "https://www.instagram.com/artexploreafrica/" → "@artexploreafrica"
const handleOf = (url) => {
  const m = url?.match(/instagram\.com\/([^/?#]+)/i);
  return m ? `@${m[1]}` : "Instagram";
};

export default function ContactSection() {
  return (
    <section className="contact" id="contact" aria-labelledby="contact-title">
      <div className="contact__inner">
        <div className="contact__intro">
          <p className="contact__eyebrow">
            <span className="contact__eyebrow-rule" aria-hidden="true" />
            Contact us
          </p>
          <h2 className="contact__title" id="contact-title">
            Get in <em>touch.</em>
          </h2>
          <p className="contact__lede">
            Partnerships, press, a correction to a listing, or just a question —
            send us a message and the team will reply by email.
          </p>

          {(CONTACT_EMAIL || INSTAGRAM_URL) && (
            <ul className="contact__ways">
              {CONTACT_EMAIL && (
                <li>
                  <a className="contact__way" href={`mailto:${CONTACT_EMAIL}`}>
                    <span className="contact__way-icon" aria-hidden="true">
                      <FiMail />
                    </span>
                    <span>
                      <span className="contact__way-label">Email</span>
                      <span className="contact__way-value">{CONTACT_EMAIL}</span>
                    </span>
                  </a>
                </li>
              )}
              {INSTAGRAM_URL && (
                <li>
                  <a className="contact__way" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
                    <span className="contact__way-icon" aria-hidden="true">
                      <FiInstagram />
                    </span>
                    <span>
                      <span className="contact__way-label">Instagram</span>
                      <span className="contact__way-value">{handleOf(INSTAGRAM_URL)}</span>
                    </span>
                  </a>
                </li>
              )}
            </ul>
          )}
        </div>

        <div className="contact__form">
          <EnquiryForm intent="REACH_OUT" />
        </div>
      </div>
    </section>
  );
}
