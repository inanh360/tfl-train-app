-- CreateEnum
CREATE TYPE "FavouriteType" AS ENUM ('LINE', 'STATION');

-- CreateTable
CREATE TABLE "Line" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modeName" TEXT NOT NULL,
    "colourHex" TEXT NOT NULL,

    CONSTRAINT "Line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineStatusEvent" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "statusSeverity" INTEGER NOT NULL,
    "statusDescription" TEXT NOT NULL,
    "reason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LineStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffectedStation" (
    "id" TEXT NOT NULL,
    "statusEventId" TEXT NOT NULL,
    "stationName" TEXT NOT NULL,
    "naptanId" TEXT,

    CONSTRAINT "AffectedStation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favourite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "favouriteType" "FavouriteType" NOT NULL,
    "refId" TEXT NOT NULL,
    "refLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lineRefId" TEXT,

    CONSTRAINT "Favourite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lineStatusEventId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "colourHex" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Line_modeName_idx" ON "Line"("modeName");

-- CreateIndex
CREATE INDEX "LineStatusEvent_lineId_isActive_idx" ON "LineStatusEvent"("lineId", "isActive");

-- CreateIndex
CREATE INDEX "AffectedStation_statusEventId_idx" ON "AffectedStation"("statusEventId");

-- CreateIndex
CREATE INDEX "AffectedStation_naptanId_idx" ON "AffectedStation"("naptanId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Favourite_userId_idx" ON "Favourite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Favourite_userId_favouriteType_refId_key" ON "Favourite"("userId", "favouriteType", "refId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- AddForeignKey
ALTER TABLE "LineStatusEvent" ADD CONSTRAINT "LineStatusEvent_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffectedStation" ADD CONSTRAINT "AffectedStation_statusEventId_fkey" FOREIGN KEY ("statusEventId") REFERENCES "LineStatusEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favourite" ADD CONSTRAINT "Favourite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favourite" ADD CONSTRAINT "Favourite_lineRefId_fkey" FOREIGN KEY ("lineRefId") REFERENCES "Line"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_lineStatusEventId_fkey" FOREIGN KEY ("lineStatusEventId") REFERENCES "LineStatusEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
