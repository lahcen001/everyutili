"use client";

import * as React from "react";

import { ErrorFallback } from "@/components/tool-shell/ErrorFallback";

interface State {
  hasError: boolean;
}

/** Keeps a crash inside one tool from taking down the surrounding page (SEO content, breadcrumbs, related tools). */
export class ToolErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Tool crashed:", error);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}
