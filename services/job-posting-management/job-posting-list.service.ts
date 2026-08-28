import type { Prisma } from "../../generated/prisma/client.js";
import { JobQueryInput } from "../../validators/job-posting.validator.js";
import { prisma } from "../../lib/prisma.js";


export const getJobListService = async (companyId: number, query: JobQueryInput) => {
    const { page, limit, sortBy, sortOrder, category, search } = query;

    const where: Prisma.JobPostingWhereInput = {
        companyId,
        deletedAt: null,
        ...(search && {
            title: {contains: search, mode: "insensitive" as const},
        }),
        ...(category && {category})
    }

    const [ jobs, total ] = await prisma.$transaction([
        prisma.jobPosting.findMany({
            where,
            orderBy: {[sortBy]: sortOrder},
            skip: (page-1)*limit,
            take: limit,
            include: {
                _count: {
                    select: {
                        applications: {
                            where: {status: {not: "DRAFT"}}
                        },
                        preSelectionTests: true
                    }
                }
            }
        }),
        prisma.jobPosting.count({where})
    ])

    return {
        data: jobs.map((job)=>({
            ...job,
            applicantCount: job._count.applications,
            questionCount: job._count.preSelectionTests,
            _count: undefined,
        })),
        meta: {
            page,
            limit,
            total,
            totalPage: Math.ceil(total/limit)
        }
    }
}