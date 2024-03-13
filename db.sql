CREATE TABLE `Admin` (
  `UserID` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(45) NOT NULL,
  `Username` varchar(45) NOT NULL,
  `Password` varchar(45) NOT NULL,
  PRIMARY KEY (`UserID`)
);

CREATE TABLE `User` (
  `UserID` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(45) NOT NULL,
  `Username` varchar(45) NOT NULL,
  `Password` varchar(45) NOT NULL,
  PRIMARY KEY (`UserID`)
);

CREATE TABLE `Policy` (
  `UserID` int NOT NULL,
  `PolicyHolder` varchar(45) NOT NULL,
  `PolicyType` varchar(45) NOT NULL,
  `PolicyNumber` int NOT NULL AUTO_INCREMENT,
  `AmountAssured` decimal(45,0) NOT NULL,
  `PremiumAmount` decimal(45,0) NOT NULL,
  `StartDate` date NOT NULL,
  `EndDate` date NOT NULL,
  PRIMARY KEY (`PolicyNumber`),
  KEY `UserID` (`UserID`),
  CONSTRAINT `policy_ibfk_1` FOREIGN KEY (`UserID`) REFERENCES `User` (`UserID`)
);

CREATE TABLE `Claim` (
  `UserID` int NOT NULL,
  `Claimant` varchar(45) NOT NULL,
  `ClaimID` int NOT NULL AUTO_INCREMENT,
  `PolicyNumber` int NOT NULL,
  `ClaimType` varchar(45) DEFAULT NULL,
  `ClaimReason` varchar(45) DEFAULT NULL,
  `ClaimAmount` decimal(45,0) NOT NULL,
  `ClaimDate` date NOT NULL,
  `Status` varchar(45) DEFAULT 'Pending',
  `Reason` varchar(255) DEFAULT 'Claim in Process',
  PRIMARY KEY (`ClaimID`),
  KEY `UserID` (`UserID`),
  KEY `PolicyNumber` (`PolicyNumber`),
  CONSTRAINT `claim_ibfk_1` FOREIGN KEY (`UserID`) REFERENCES `User` (`UserID`),
  CONSTRAINT `claim_ibfk_2` FOREIGN KEY (`PolicyNumber`) REFERENCES `Policy` (`PolicyNumber`)
);