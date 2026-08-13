import React from "react";
import { Modal } from "@heroui/react";

interface AppModalProps {
  state: NonNullable<React.ComponentProps<typeof Modal.Root>["state"]>;
  ariaLabel: string;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  bodyClassName?: string;
}

const AppModal: React.FC<AppModalProps> = ({
  state,
  ariaLabel,
  title,
  children,
  footer,
  bodyClassName,
}) => (
  <Modal.Root state={state}>
    <Modal.Backdrop variant="blur">
      <Modal.Container placement="center" size="sm">
        <Modal.Dialog aria-label={ariaLabel}>
          <Modal.CloseTrigger
            aria-label={`${ariaLabel} 닫기`}
            className="!top-[1.375rem] !size-8 !rounded-full !bg-slate-100 !text-pkpk-dark hover:!bg-slate-200"
          />
          <Modal.Header>
            <Modal.Heading className="!text-2xl !font-bold !leading-7 !text-pkpk-dark">
              {title}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body
            className={["text-left", bodyClassName].filter(Boolean).join(" ")}
          >
            {children}
          </Modal.Body>
          {footer ? <Modal.Footer>{footer}</Modal.Footer> : null}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  </Modal.Root>
);

export default AppModal;
