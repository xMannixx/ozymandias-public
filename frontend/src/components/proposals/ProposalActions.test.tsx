import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProposalActions from "@/components/proposals/ProposalActions";
import { mockProposalConfirmed, mockProposalPending } from "@/test/fixtures";

function deferredPromise(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = () => done();
  });
  return { promise, resolve };
}

describe("ProposalActions", () => {
  it("shows decision text for non-pending proposal", () => {
    render(
      <ProposalActions
        proposal={mockProposalConfirmed}
        onApprove={async () => undefined}
        onReject={async () => undefined}
      />,
    );
    expect(screen.getByText(/Entscheidung:/)).toBeInTheDocument();
  });

  it("calls approve action", async () => {
    const onApprove = vi.fn(async () => undefined);
    render(<ProposalActions proposal={mockProposalPending} onApprove={onApprove} onReject={async () => undefined} />);

    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onApprove).toHaveBeenCalledWith(mockProposalPending.proposal_id);
  });

  it("calls reject action with reason", async () => {
    const onReject = vi.fn(async () => undefined);
    render(<ProposalActions proposal={mockProposalPending} onApprove={async () => undefined} onReject={onReject} />);

    await userEvent.type(screen.getByLabelText("reject-reason"), "duplicate");
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onReject).toHaveBeenCalledWith(mockProposalPending.proposal_id, "duplicate");
  });

  it("calls reject action with empty reason when not provided", async () => {
    const onReject = vi.fn(async () => undefined);
    render(<ProposalActions proposal={mockProposalPending} onApprove={async () => undefined} onReject={onReject} />);

    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onReject).toHaveBeenCalledWith(mockProposalPending.proposal_id, "");
  });

  it("updates reject reason input", async () => {
    render(
      <ProposalActions
        proposal={mockProposalPending}
        onApprove={async () => undefined}
        onReject={async () => undefined}
      />,
    );
    const input = screen.getByLabelText("reject-reason") as HTMLInputElement;
    await userEvent.type(input, "policy conflict");
    expect(input.value).toBe("policy conflict");
  });

  it("disables buttons while async action is pending", async () => {
    const deferred = deferredPromise();
    const onApprove = vi.fn(() => deferred.promise);
    render(<ProposalActions proposal={mockProposalPending} onApprove={onApprove} onReject={async () => undefined} />);

    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
    deferred.resolve();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Approve" })).not.toBeDisabled();
    });
  });
});
