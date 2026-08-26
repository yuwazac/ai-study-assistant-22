import { BookOpen, FileText, MessageSquareText } from "lucide-react";
import { FileUpload } from "@/component/file-upload";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <main className="min-h-dvh w-full overflow-x-clip bg-white text-black">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 lg:py-14">
        <header className="mb-8 sm:mb-10">
          <Badge variant="secondary" className="mb-4">
            AI-powered learning
          </Badge>

          <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">
            AI Study Assistant
          </h1>

          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Upload your notes or PDF documents and ask questions based on their
            content.
          </p>
        </header>

        {/* <section
          aria-label="How the study assistant works"
          className="grid min-w-0 gap-4 md:grid-cols-3"
        >
          <FeatureCard
            icon={FileText}
            title="Upload notes"
            description="Upload PDF or text files containing your study material."
          />

          <FeatureCard
            icon={BookOpen}
            title="Process content"
            description="Extract and prepare the document content for retrieval."
          />

          <FeatureCard
            icon={MessageSquareText}
            title="Ask questions"
            description="Receive answers grounded in your uploaded material."
          />
        </section> */}

        <section className="mt-8">
          <FileUpload />
        </section>
      </div>
    </main>
  );
}

type FeatureCardProps = {
  icon: React.ElementType;
  title: string;
  description: string;
};

function FeatureCard({
  icon: Icon,
  title,
  description,
}: FeatureCardProps) {
  return (
    <Card className="h-full min-w-0">
      <CardHeader className="p-4 sm:p-(--card-spacing)">
        <Icon aria-hidden="true" className="mb-2 size-5 text-primary" />
        <CardTitle>{title}</CardTitle>
      </CardHeader>

      <CardContent className="px-4 sm:px-(--card-spacing)">
        <CardDescription className="leading-6">
          {description}
        </CardDescription>
      </CardContent>
    </Card>
  );
}
