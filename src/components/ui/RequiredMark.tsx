/** The visual "required" star after a field label. Hidden from assistive tech: the control itself carries `required`, and the form's hint line explains the star. */
export function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-0.5 text-danger">
      *
    </span>
  );
}
