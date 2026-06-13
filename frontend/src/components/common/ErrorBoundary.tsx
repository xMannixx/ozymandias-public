import { Component, type ErrorInfo, type ReactNode } from "react";
import GlassCard from "@/components/common/GlassCard";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ErrorBoundary caught error", error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <GlassCard className="m-4">
          <h2 className="mb-2 text-lg font-semibold text-red-300">Etwas ist schiefgelaufen</h2>
          <p className="text-sm text-gray-300">Bitte Seite neu laden.</p>
        </GlassCard>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
