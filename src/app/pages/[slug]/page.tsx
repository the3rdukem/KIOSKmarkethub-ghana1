"use client";

import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import { SiteLayout } from "@/components/layout/site-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { sanitizeHTML } from "@/lib/utils/sanitize";

interface StaticPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  meta_title: string | null;
  meta_description: string | null;
  is_published: boolean;
}

export default function StaticPageView() {
  const params = useParams();
  const slug = params.slug as string;
  const [page, setPage] = useState<StaticPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);

  useEffect(() => {
    const fetchPage = async () => {
      try {
        const response = await fetch(`/api/pages/${slug}`);
        if (response.status === 404) {
          setNotFoundState(true);
          return;
        }
        if (!response.ok) {
          throw new Error('Failed to fetch page');
        }
        const data = await response.json();
        setPage(data.page);
      } catch (error) {
        console.error('Failed to fetch page:', error);
        setNotFoundState(true);
      } finally {
        setIsLoading(false);
      }
    };

    if (slug) {
      fetchPage();
    }
  }, [slug]);

  if (notFoundState) {
    notFound();
  }

  if (isLoading) {
    return (
      <SiteLayout>
        <div className="container py-12 max-w-4xl">
          <Skeleton className="h-12 w-3/4 mb-6" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-2/3 mb-2" />
        </div>
      </SiteLayout>
    );
  }

  if (!page) {
    return null;
  }

  return (
    <SiteLayout>
      <div className="container py-12 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">{page.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="prose prose-lg max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHTML(page.content) }}
            />
          </CardContent>
        </Card>
      </div>
    </SiteLayout>
  );
}
