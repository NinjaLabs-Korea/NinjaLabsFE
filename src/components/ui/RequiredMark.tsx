/**
 * The visual "required" star after a field label. Hidden from assistive tech: a single control carries `required`, a radio
 * group carries `aria-required` on its `radiogroup`, and the form's hint line explains the star. Checkbox/toggle groups
 * (interest areas, field tags) have no valid ARIA required state, so for them the star is visual only and the message
 * on a failed submit is what tells assistive tech.
 */
export function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-0.5 text-danger">
      *
    </span>
  );
}
