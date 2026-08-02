import Button from "@/components/common/Button";
import Modal from "@/components/common/Modal";

type S3ConfirmModalsProps = {
  liveWebMessage: string | null;
  fallbackMessage: string | null;
  onConfirmLiveWeb: () => void;
  onCancelLiveWeb: () => void;
  onConfirmFallback: () => void;
  onCancelFallback: () => void;
};

/**
 * The two one-off permissions a sensitive (S3) message can ask for: reaching the
 * live web, or leaving the local provider. Both default to no.
 */
function S3ConfirmModals({
  liveWebMessage,
  fallbackMessage,
  onConfirmLiveWeb,
  onCancelLiveWeb,
  onConfirmFallback,
  onCancelFallback,
}: S3ConfirmModalsProps): JSX.Element {
  return (
    <>
      <Modal
        open={Boolean(liveWebMessage)}
        onClose={onCancelLiveWeb}
        title="Allow web access for this message?"
      >
        <p className="mb-4 text-sm text-zinc-300">
          {liveWebMessage
            ?? "This message contains sensitive content. Should I look things up on the web this once?"}
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancelLiveWeb}>
            Keep it offline
          </Button>
          <Button type="button" onClick={onConfirmLiveWeb}>
            Allow once
          </Button>
        </div>
      </Modal>
      <Modal
        open={Boolean(fallbackMessage)}
        onClose={onCancelFallback}
        title="Send this message to the cloud?"
      >
        <p className="mb-4 text-sm text-zinc-300">
          {fallbackMessage
            ?? "The local model is unavailable. Should this sensitive message go to a cloud provider this once?"}
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancelFallback}>
            Keep it local
          </Button>
          <Button type="button" onClick={onConfirmFallback}>
            Allow once
          </Button>
        </div>
      </Modal>
    </>
  );
}

export default S3ConfirmModals;
