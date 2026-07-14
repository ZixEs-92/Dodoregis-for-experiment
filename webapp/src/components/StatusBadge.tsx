import { RequestStatus } from "@/generated/prisma/client";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/workflow";

export default function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={`chip ${STATUS_COLOR[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
