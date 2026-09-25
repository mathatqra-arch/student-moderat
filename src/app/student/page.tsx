"use client";

import { useState } from "react";
import StudentHeader from "@/components/student/StudentHeader";
import StudentNav from "@/components/student/StudentNav";
import AnnouncementsFeed from "@/components/student/AnnouncementsFeed";
import TasksTracker from "@/components/student/TasksTracker";
import InquiryForm from "@/components/student/InquiryForm";
import QuickLinksSection from "@/components/student/QuickLinksSection";

export default function StudentPage() {
  const [activeTab, setActiveTab] = useState<"announcements" | "tasks" | "inquiry" | "links">("announcements");

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))] pb-24">
      <StudentHeader />

      <main className="max-w-md mx-auto p-4 space-y-4">
        <div key={activeTab} className="animate-fade-in">
          {activeTab === "announcements" && <AnnouncementsFeed />}
          {activeTab === "tasks" && <TasksTracker />}
          {activeTab === "inquiry" && <InquiryForm />}
          {activeTab === "links" && <QuickLinksSection />}
        </div>
      </main>

      <StudentNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
